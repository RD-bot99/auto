import { useGetAnalyticsOverview, useGetPostAnalytics } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Eye, Heart, MessageSquare, TrendingUp, Loader2 } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";

export default function Analytics() {
  const { data: overview, isLoading: overviewLoading } = useGetAnalyticsOverview();
  const { data: posts, isLoading: postsLoading } = useGetPostAnalytics();

  if (overviewLoading || postsLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Aggregate stats from posts
  const totalViews = posts?.reduce((acc, p) => acc + p.views, 0) || 0;
  const totalLikes = posts?.reduce((acc, p) => acc + p.likes, 0) || 0;
  const totalComments = posts?.reduce((acc, p) => acc + p.comments, 0) || 0;
  const avgEngagement = posts?.length ? (posts.reduce((acc, p) => acc + p.engagementRate, 0) / posts.length) : 0;

  // Colors mapping for chart
  const getPlatformColor = (platform: string) => {
    switch(platform) {
      case 'tiktok': return 'hsl(348 100% 50%)'; // Rose
      case 'youtube': return 'hsl(0 100% 50%)'; // Red
      case 'instagram': return 'hsl(326 100% 50%)'; // Pink
      default: return 'hsl(270 100% 65%)'; // Primary
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Measure your success and optimize your strategy.</p>
      </div>

      {/* Aggregate Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Total Views</p>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-4xl font-display font-bold text-white">{totalViews.toLocaleString()}</h3>
        </div>

        <div className="glass rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all duration-500" />
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Total Likes</p>
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              <Heart className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-4xl font-display font-bold text-white">{totalLikes.toLocaleString()}</h3>
        </div>

        <div className="glass rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500" />
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Total Comments</p>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-4xl font-display font-bold text-white">{totalComments.toLocaleString()}</h3>
        </div>

        <div className="glass rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Avg Engagement</p>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-4xl font-display font-bold text-white">{avgEngagement.toFixed(1)}%</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart */}
        <div className="glass rounded-3xl p-6">
          <h2 className="text-xl font-display font-bold text-white mb-6">Publications per Platform</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.platformBreakdown || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="platform" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                  tickFormatter={(val) => val.charAt(0).toUpperCase() + val.slice(1)}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'hsl(240 10% 8%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Bar dataKey="published" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {overview?.platformBreakdown?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPlatformColor(entry.platform)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Posts Table */}
        <div className="glass rounded-3xl p-6 flex flex-col">
          <h2 className="text-xl font-display font-bold text-white mb-6">Top Performing Posts</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              {posts?.sort((a, b) => b.views - a.views).slice(0, 5).map((post, i) => (
                <div key={post.scheduledPostId} className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className="font-display font-bold text-xl text-white/20 w-6 text-center">
                    {i + 1}
                  </div>
                  <PlatformIcon platform={post.platform} className="w-8 h-8 opacity-80" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white truncate">{post.videoTitle}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">{post.engagementRate.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">Eng. Rate</p>
                  </div>
                </div>
              ))}
              {!posts?.length && (
                 <div className="text-center py-8 text-muted-foreground">No published posts data yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
