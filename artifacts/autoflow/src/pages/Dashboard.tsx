import { useGetAnalyticsOverview, useGetPlatformConnections, useGetScheduledPosts } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Video, CalendarDays, CheckCircle2, XCircle, ArrowRight, Loader2, Sparkles, Clock } from "lucide-react";
import { Link } from "wouter";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function StatCard({ title, value, icon: Icon, colorClass }: any) {
  return (
    <div className="glass rounded-2xl p-6 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-10 rounded-bl-full group-hover:scale-110 transition-transform duration-500`} />
      <div className="flex items-center gap-4 relative z-10">
        <div className={`w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center ${colorClass.split(' ')[0].replace('from-', 'text-')}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-muted-foreground font-medium text-sm">{title}</p>
          <h3 className="text-3xl font-display font-bold text-white mt-1">{value}</h3>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsOverview();
  const { data: connections, isLoading: connectionsLoading } = useGetPlatformConnections();
  const { data: upcomingPosts, isLoading: postsLoading } = useGetScheduledPosts({ status: 'pending' });

  if (analyticsLoading || connectionsLoading || postsLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your content.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Videos" value={analytics?.totalVideos || 0} icon={Video} colorClass="from-blue-500 to-cyan-500" />
        <StatCard title="Scheduled" value={analytics?.totalScheduled || 0} icon={CalendarDays} colorClass="from-primary to-purple-500" />
        <StatCard title="Published" value={analytics?.totalPublished || 0} icon={CheckCircle2} colorClass="from-green-500 to-emerald-500" />
        <StatCard title="Failed" value={analytics?.totalFailed || 0} icon={XCircle} colorClass="from-red-500 to-rose-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Connections & Recent */}
        <div className="xl:col-span-2 space-y-8">
          
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-white">Platform Status</h2>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="h-8 border-white/10 hover:bg-white/5">Manage</Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['tiktok', 'youtube', 'instagram'].map((platformName) => {
                const conn = connections?.find(c => c.platform === platformName);
                const isConnected = conn?.status === 'connected';

                return (
                  <div key={platformName} className="bg-black/30 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <PlatformIcon platform={platformName} withBg className="w-10 h-10 rounded-lg" />
                      <div>
                        <h3 className="capitalize font-semibold text-white">{platformName}</h3>
                        {isConnected ? (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">Not Connected</span>
                        )}
                      </div>
                    </div>
                    {isConnected && conn ? (
                      <div className="bg-black/40 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">@{conn.username}</p>
                        <p className="font-semibold text-sm">{conn.followerCount?.toLocaleString()} followers</p>
                      </div>
                    ) : (
                      <Link href="/settings">
                        <Button className="w-full h-9 bg-white/5 hover:bg-white/10 text-white border border-white/10">
                          Connect Now
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-white">Recent Activity</h2>
              <Link href="/analytics">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-transparent">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {analytics?.recentActivity?.length ? (
                analytics.recentActivity.map((post) => (
                  <div key={post.id} className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                    <PlatformIcon platform={post.platform} className="w-8 h-8 opacity-80" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-white truncate">{post.video?.title || "Untitled Video"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(post.scheduledAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Badge variant="outline" className={`
                      ${post.status === 'published' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : ''}
                      ${post.status === 'failed' ? 'border-rose-500/30 text-rose-400 bg-rose-500/10' : ''}
                      ${post.status === 'pending' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : ''}
                      capitalize
                    `}>
                      {post.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity found.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Upcoming Queue */}
        <div className="glass rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-display font-bold text-white">Up Next</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {upcomingPosts && upcomingPosts.length > 0 ? (
              upcomingPosts.map((post) => (
                <div key={post.id} className="relative pl-6 pb-6 last:pb-0 border-l border-white/10 last:border-transparent">
                  <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-primary">
                        {format(new Date(post.scheduledAt), "MMM d, h:mm a")}
                      </span>
                      <PlatformIcon platform={post.platform} className="w-4 h-4 opacity-70" />
                    </div>
                    <p className="font-medium text-sm text-white line-clamp-2 leading-snug">
                      {post.video?.title || "Untitled Video"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-black/20 rounded-xl border border-white/5 border-dashed">
                <CalendarDays className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm font-medium text-white">Queue is empty</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Schedule your next viral hit</p>
                <Link href="/scheduler">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-full px-6">
                    Schedule Post
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
