import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Store, Loader2 } from "lucide-react";

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError("লগইন ব্যর্থ হয়েছে। ইমেইল ও পাসওয়ার্ড চেক করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">জিসান ট্রেডার্স</h1>
          <p className="text-muted-foreground text-sm mt-1">ইনভেন্টরি ও সেলস ম্যানেজমেন্ট</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">ইমেইল</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-input bg-card text-foreground text-base focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="example@email.com" required />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">পাসওয়ার্ড</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-input bg-card text-foreground text-base focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••" required />
          </div>
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "লগইন করুন"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
