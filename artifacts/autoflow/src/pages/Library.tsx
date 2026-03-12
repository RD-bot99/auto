import { useState } from "react";
import { Link } from "wouter";
import { useGetVideos, useCreateVideo, useAnalyzeVideo, useDeleteVideo } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Search, Plus, Filter, Play, Trash2, BrainCircuit, Loader2, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function UploadDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createVideoMutation = useCreateVideo();
  
  const [formData, setFormData] = useState({
    title: "",
    fileUrl: "",
    description: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createVideoMutation.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        toast({ title: "Video added to library!" });
        onOpenChange(false);
        setFormData({ title: "", fileUrl: "", description: "" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold">Add Video</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Title</label>
            <Input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              className="bg-black/30 border-white/10 text-white focus-visible:ring-primary" 
              required 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Video URL (e.g. S3, presigned URL)</label>
            <Input 
              value={formData.fileUrl} 
              onChange={e => setFormData({...formData, fileUrl: e.target.value})} 
              className="bg-black/30 border-white/10 text-white focus-visible:ring-primary" 
              required 
              type="url"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Description (Optional)</label>
            <textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" 
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90 text-white" 
            disabled={createVideoMutation.isPending}
          >
            {createVideoMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Video"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Library() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const { data: videos, isLoading } = useGetVideos(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  
  const analyzeMutation = useAnalyzeVideo();
  const deleteMutation = useDeleteVideo();

  const handleAnalyze = (id: number) => {
    analyzeMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        toast({ title: "Analysis complete", description: "AI suggestions have been generated." });
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Are you sure you want to delete this video?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
          toast({ title: "Video deleted" });
        }
      });
    }
  };

  const filteredVideos = videos?.filter(v => v.title.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Video Library</h1>
          <p className="text-muted-foreground mt-1">Manage, analyze, and prep your content for posting.</p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)} className="bg-white text-black hover:bg-white/90 font-semibold rounded-xl px-6">
          <Plus className="w-5 h-5 mr-2" /> Upload Video
        </Button>
      </div>

      <UploadDialog open={isUploadOpen} onOpenChange={setIsUploadOpen} />

      <div className="glass rounded-2xl p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search videos..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-black/30 border-white/10 text-white rounded-xl focus-visible:ring-primary h-12"
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-black/30 border-white/10 text-white rounded-xl h-12">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
              <SelectItem value="analyzed">Analyzed</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center border-dashed border-2 border-white/10 flex flex-col items-center">
          <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center mb-4">
            <VideoIcon className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-display font-bold text-white mb-2">No videos found</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">Upload your first video to start analyzing and scheduling content across platforms.</p>
          <Button onClick={() => setIsUploadOpen(true)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            Upload Now
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredVideos.map((video) => (
              <motion.div
                key={video.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass rounded-2xl overflow-hidden group flex flex-col border border-white/5 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(168,85,247,0.15)]"
              >
                {/* Thumbnail Area */}
                <div className="relative aspect-video bg-black/60 flex items-center justify-center overflow-hidden">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-500" />
                  ) : (
                    <VideoIcon className="w-12 h-12 text-white/20" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {video.viralityScore && (
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow-lg">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs font-bold text-white">{video.viralityScore}/100</span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <Badge variant="secondary" className="bg-black/70 backdrop-blur-md border-white/10 text-white capitalize shadow-lg">
                      {video.status}
                    </Badge>
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-semibold text-white line-clamp-2 mb-1 group-hover:text-primary transition-colors">{video.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{format(new Date(video.createdAt), "MMM d, yyyy")}</p>
                  
                  <div className="mt-auto flex items-center gap-2 pt-4 border-t border-white/5">
                    {video.status !== 'analyzed' && video.status !== 'analyzing' && (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 h-9"
                        onClick={() => handleAnalyze(video.id)}
                        disabled={analyzeMutation.isPending && analyzeMutation.variables?.id === video.id}
                      >
                        {analyzeMutation.isPending && analyzeMutation.variables?.id === video.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><BrainCircuit className="w-4 h-4 mr-2" /> Analyze AI</>
                        )}
                      </Button>
                    )}
                    {video.status === 'analyzing' && (
                      <Button size="sm" variant="secondary" disabled className="flex-1 h-9 bg-white/5 text-muted-foreground border-white/5">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...
                      </Button>
                    )}
                    {(video.status === 'analyzed' || video.status === 'scheduled') && (
                       <Link href={`/scheduler?videoId=${video.id}`} className="flex-1">
                          <Button size="sm" className="w-full h-9 bg-white text-black hover:bg-white/90">
                            Schedule
                          </Button>
                       </Link>
                    )}
                    
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(video.id)}
                      disabled={deleteMutation.isPending && deleteMutation.variables?.id === video.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
