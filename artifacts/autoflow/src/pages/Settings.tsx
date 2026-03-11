import { useGetPlatformConnections, useConnectPlatform, useDisconnectPlatform, useGetMe } from "@workspace/api-client-react";
import { useState } from "react";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { User, Bell, Shield, Link as LinkIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const { data: connections, isLoading } = useGetPlatformConnections();
  
  const connectMutation = useConnectPlatform();
  const disconnectMutation = useDisconnectPlatform();

  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null);
  const [username, setUsername] = useState("");

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if(!selectedPlatform || !username) return;

    // Simulating OAuth by taking a username
    connectMutation.mutate({
      platform: selectedPlatform,
      data: { username, followerCount: Math.floor(Math.random() * 100000) } // Mock data for demo
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
        toast({ title: "Platform connected successfully!" });
        setConnectModalOpen(false);
        setUsername("");
      }
    });
  };

  const handleDisconnect = (platform: any) => {
    if(confirm(`Disconnect ${platform}?`)) {
      disconnectMutation.mutate({ platform }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
          toast({ title: "Platform disconnected." });
        }
      });
    }
  };

  const openConnectModal = (platform: string) => {
    setSelectedPlatform(platform);
    setConnectModalOpen(true);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace and connections.</p>
      </div>

      <Dialog open={connectModalOpen} onOpenChange={setConnectModalOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
              Connect {selectedPlatform && <PlatformIcon platform={selectedPlatform} className="w-6 h-6" />}
              <span className="capitalize">{selectedPlatform}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConnect} className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              For this demo, simply enter a username to mock the OAuth connection process.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                placeholder="@username"
                className="bg-black/30 border-white/10 text-white"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Settings Navigation */}
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-medium border border-white/10">
            <LinkIcon className="w-5 h-5 text-primary" /> Connections
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 font-medium transition-colors cursor-not-allowed opacity-50">
            <User className="w-5 h-5" /> Account Profile
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 font-medium transition-colors cursor-not-allowed opacity-50">
            <Bell className="w-5 h-5" /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 font-medium transition-colors cursor-not-allowed opacity-50">
            <Shield className="w-5 h-5" /> Security
          </button>
        </div>

        {/* Content */}
        <div className="md:col-span-3 space-y-6">
          <div className="glass rounded-3xl p-8">
            <h2 className="text-xl font-display font-bold text-white mb-6 border-b border-white/10 pb-4">Connected Platforms</h2>
            
            {isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4">
                {['tiktok', 'youtube', 'instagram'].map((platform) => {
                  const conn = connections?.find(c => c.platform === platform);
                  const isConnected = conn?.status === 'connected';

                  return (
                    <div key={platform} className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5 hover:bg-black/40 transition-colors">
                      <div className="flex items-center gap-4">
                        <PlatformIcon platform={platform} withBg className="w-12 h-12 rounded-xl" />
                        <div>
                          <h3 className="font-semibold text-white capitalize text-lg leading-tight">{platform}</h3>
                          {isConnected && conn ? (
                            <p className="text-sm text-muted-foreground mt-1">
                              Connected as <span className="text-white font-medium">@{conn.username}</span>
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">Not connected</p>
                          )}
                        </div>
                      </div>
                      <div>
                        {isConnected ? (
                          <Button 
                            variant="outline" 
                            className="border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            onClick={() => handleDisconnect(platform)}
                            disabled={disconnectMutation.isPending}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button 
                            className="bg-white text-black hover:bg-white/90"
                            onClick={() => openConnectModal(platform)}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass rounded-3xl p-8">
            <h2 className="text-xl font-display font-bold text-white mb-6 border-b border-white/10 pb-4">Workspace Info</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">Email Address</label>
                <Input disabled value={user?.email || ""} className="bg-black/20 border-white/5 text-white/70" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">Configured Timezone</label>
                <Input disabled value={user?.timezone || ""} className="bg-black/20 border-white/5 text-white/70" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
