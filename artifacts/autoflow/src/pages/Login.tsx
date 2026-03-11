import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        toast({ title: "Welcome back!", description: "Successfully logged in." });
        setLocation("/");
      },
      onError: (err: any) => {
        toast({ 
          title: "Login failed", 
          description: err?.message || "Please check your credentials.", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex bg-background selection:bg-primary/30">
      {/* Visual Section */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
          alt="Abstract background"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/50" />
        
        <div className="relative z-10 max-w-xl px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-16 h-16 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
              <Zap className="w-8 h-8 text-primary fill-primary" />
            </div>
            <h1 className="text-5xl font-display font-bold text-white mb-6 leading-tight">
              Automate your <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">content empire.</span>
            </h1>
            <p className="text-lg text-muted-foreground/80 leading-relaxed">
              AutoFlow analyzes, schedules, and publishes your content across TikTok, YouTube, and Instagram at the exact right moment for maximum virality.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10 bg-background/95 backdrop-blur-sm lg:backdrop-blur-none lg:bg-transparent">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-display font-bold text-white mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your AutoFlow workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  type="email" 
                  placeholder="Email address" 
                  className="pl-12 h-14 bg-black/20 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus-visible:ring-primary focus-visible:border-primary transition-all shadow-inner"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  type="password" 
                  placeholder="Password" 
                  className="pl-12 h-14 bg-black/20 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus-visible:ring-primary focus-visible:border-primary transition-all shadow-inner"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 rounded-xl text-lg font-semibold bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 transition-all duration-300"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:text-primary/80 font-medium hover:underline transition-all">
              Create an account <ArrowRight className="inline w-4 h-4 ml-1" />
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
