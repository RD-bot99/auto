import { useState } from "react";
import { useGetScheduledPosts, useGetVideos, useCreateScheduledPost, useGetOptimalTimes, usePublishNow } from "@workspace/api-client-react";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { CalendarDays, List, Plus, Sparkles, Loader2, Rocket, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";

function ScheduleModal({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  
  const { data: videos } = useGetVideos({ status: 'analyzed' });
  const createMutation = useCreateScheduledPost();
  const optimalTimesMutation = useGetOptimalTimes();
  
  const [formData, setFormData] = useState({
    videoId: "",
    platform: "tiktok" as any,
    scheduledAt: format(addDays(new Date(), 1), "yyyy-MM-dd'T'12:00"),
    caption: ""
  });

  const [optimalTimes, setOptimalTimes] = useState<any[]>([]);

  const fetchOptimalTimes = () => {
    optimalTimesMutation.mutate({ data: { platform: formData.platform } }, {
      onSuccess: (data) => setOptimalTimes(data)
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.videoId) return toast({ title: "Select a video", variant: "destructive"});
    
    createMutation.mutate({ 
      data: {
        ...formData,
        videoId: parseInt(formData.videoId),
        scheduledAt: new Date(formData.scheduledAt).toISOString()
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
        toast({ title: "Post scheduled!" });
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold">Schedule Post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Select Analyzed Video</label>
            <Select value={formData.videoId} onValueChange={v => setFormData({...formData, videoId: v})}>
              <SelectTrigger className="bg-black/30 border-white/10 h-12">
                <SelectValue placeholder="Choose a video..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-white/10">
                {videos?.map(v => (
                  <SelectItem key={v.id} value={v.id.toString()}>{v.title}</SelectItem>
                ))}
                {videos?.length === 0 && <div className="p-2 text-sm text-muted-foreground">No analyzed videos available.</div>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Platform</label>
            <div className="grid grid-cols-3 gap-3">
              {['tiktok', 'youtube', 'instagram'].map((p) => (
                <div 
                  key={p} 
                  onClick={() => setFormData({...formData, platform: p as any})}
                  className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${
                    formData.platform === p 
                      ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                      : 'bg-black/30 border-white/10 text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  <PlatformIcon platform={p} className={formData.platform === p ? "" : "opacity-60"} />
                  <span className="text-xs font-semibold capitalize">{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Schedule Time</label>
              <Button type="button" variant="ghost" size="sm" onClick={fetchOptimalTimes} className="h-6 px-2 text-xs text-primary hover:text-primary/80">
                <Sparkles className="w-3 h-3 mr-1" /> Get Optimal Times
              </Button>
            </div>
            <Input 
              type="datetime-local" 
              value={formData.scheduledAt}
              onChange={e => setFormData({...formData, scheduledAt: e.target.value})}
              className="bg-black/30 border-white/10 h-12 text-white [color-scheme:dark]"
              required
            />
            {optimalTimes.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2 custom-scrollbar">
                {optimalTimes.map((t, i) => (
                  <Badge 
                    key={i} 
                    variant="outline" 
                    className="cursor-pointer whitespace-nowrap bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                    onClick={() => setFormData({...formData, scheduledAt: format(new Date(t.datetime), "yyyy-MM-dd'T'HH:mm")})}
                  >
                    {format(new Date(t.datetime), "h:mm a")} ({Math.round(t.confidence * 100)}%)
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Caption</label>
            <textarea 
              value={formData.caption}
              onChange={e => setFormData({...formData, caption: e.target.value})}
              className="flex min-h-[100px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" 
              placeholder="Write an engaging caption..."
            />
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Schedule Post"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Scheduler() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"calendar" | "list">("list");
  const { data: posts, isLoading } = useGetScheduledPosts();
  const publishMutation = usePublishNow();

  const handlePublishNow = (id: number) => {
    publishMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
        toast({ title: "Publishing initiated!" });
      }
    });
  };

  // Simple calendar math
  const today = new Date();
  const start = startOfWeek(today);
  const end = endOfWeek(today);
  const weekDays = eachDayOfInterval({ start, end });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Scheduler</h1>
          <p className="text-muted-foreground mt-1">Plan your posts and let AutoFlow handle the rest.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass rounded-xl p-1 flex">
            <button 
              onClick={() => setView("list")} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView("calendar")} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'calendar' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
          <ScheduleModal>
            <Button className="bg-white text-black hover:bg-white/90 font-semibold rounded-xl px-6 h-11 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <Plus className="w-5 h-5 mr-2" /> New Post
            </Button>
          </ScheduleModal>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {view === "calendar" ? (
            <div className="glass rounded-3xl p-6">
              <div className="grid grid-cols-7 gap-4 mb-4">
                {weekDays.map(day => (
                  <div key={day.toISOString()} className="text-center">
                    <p className="text-xs text-muted-foreground font-medium uppercase mb-1">{format(day, 'EEE')}</p>
                    <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-bold ${isSameDay(day, today) ? 'bg-primary text-white' : 'text-white'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4 min-h-[400px]">
                {weekDays.map(day => {
                  const dayPosts = posts?.filter(p => isSameDay(new Date(p.scheduledAt), day)) || [];
                  return (
                    <div key={`col-${day.toISOString()}`} className="bg-black/20 rounded-xl border border-white/5 p-2 space-y-2 overflow-y-auto">
                      {dayPosts.map(post => (
                        <div key={post.id} className="bg-white/5 rounded-lg p-2 border border-white/10 text-xs group relative overflow-hidden">
                          <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                            post.platform === 'tiktok' ? 'bg-rose-500' : post.platform === 'youtube' ? 'bg-red-500' : 'bg-fuchsia-500'
                          }`} />
                          <div className="pl-2">
                            <p className="font-semibold text-white truncate">{format(new Date(post.scheduledAt), "h:mm a")}</p>
                            <p className="text-muted-foreground truncate opacity-80">{post.video?.title || "Draft"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="p-4 font-semibold text-muted-foreground text-sm">Platform</th>
                      <th className="p-4 font-semibold text-muted-foreground text-sm">Video</th>
                      <th className="p-4 font-semibold text-muted-foreground text-sm">Scheduled Time</th>
                      <th className="p-4 font-semibold text-muted-foreground text-sm">Status</th>
                      <th className="p-4 font-semibold text-muted-foreground text-sm text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts?.map((post) => (
                      <tr key={post.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                        <td className="p-4">
                          <PlatformIcon platform={post.platform} withBg className="w-10 h-10 rounded-xl" />
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-white max-w-xs truncate">{post.video?.title || "Untitled"}</p>
                          <p className="text-xs text-muted-foreground max-w-xs truncate mt-0.5">{post.caption}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm text-white">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span>{format(new Date(post.scheduledAt), "MMM d, yyyy")}</span>
                            <span className="text-muted-foreground">{format(new Date(post.scheduledAt), "h:mm a")}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={`
                            ${post.status === 'published' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : ''}
                            ${post.status === 'failed' ? 'border-rose-500/30 text-rose-400 bg-rose-500/10' : ''}
                            ${post.status === 'pending' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : ''}
                            capitalize px-3 py-1 rounded-full
                          `}>
                            {post.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          {post.status === 'pending' && (
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => handlePublishNow(post.id)}
                              disabled={publishMutation.isPending && publishMutation.variables?.id === post.id}
                              className="bg-primary/10 text-primary hover:bg-primary hover:text-white border-none"
                            >
                              {publishMutation.isPending && publishMutation.variables?.id === post.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <><Rocket className="w-4 h-4 mr-2" /> Publish Now</>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {posts?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No scheduled posts. Click "New Post" to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
