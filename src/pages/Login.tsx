import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Loader2, Eye, EyeOff, ShieldCheck, Sparkles, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fadeUp, EASE_OUT } from "@/lib/motion";

export default function Login() {
  const { signIn, session } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { disabled?: boolean; noProfile?: boolean } };

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <button
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 lg:right-8 lg:top-8"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Luxury brand panel — desktop only */}
      <div className="relative hidden w-[46%] shrink-0 overflow-hidden bg-gradient-to-br from-navy-700 via-navy-600 to-navy-900 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gold-400/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-emerald-luxe-500/10 blur-2xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex flex-1 flex-col justify-center px-14 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-navy-900 shadow-lg shadow-gold-500/30"
          >
            <Building2 className="h-8 w-8" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
            className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white"
          >
            Jikmis Apartment
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease: EASE_OUT }}
            className="mt-3 max-w-sm text-base text-navy-200"
          >
            The front desk control center for reservations, guests, and revenue — all in one refined workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26, ease: EASE_OUT }}
            className="mt-10 space-y-4"
          >
            <div className="flex items-center gap-3 text-sm text-navy-100">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                <ShieldCheck className="h-4 w-4 text-emerald-luxe-300" />
              </span>
              Secure, role-based access for your whole team
            </div>
            <div className="flex items-center gap-3 text-sm text-navy-100">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Sparkles className="h-4 w-4 text-gold-300" />
              </span>
              Real-time bookings, payments, and reporting
            </div>
          </motion.div>
        </div>

        <p className="relative px-14 pb-10 text-xs text-navy-300">© {new Date().getFullYear()} Jikmis Apartment. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 text-white shadow-md shadow-navy-500/30">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Jikmis Apartment</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to the front desk system</p>
          </div>

          <div className="hidden text-left lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-600 dark:text-gold-400">Welcome back</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Sign in to your account</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter your credentials to access the dashboard.</p>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 card-shadow dark:border-slate-800 dark:bg-slate-900">
            {location.state?.disabled && (
              <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                Your account has been disabled. Contact the administrator.
              </div>
            )}
            {location.state?.noProfile && (
              <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                We couldn't find a staff profile for this account. Contact the administrator.
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@jikmisapartment.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center text-slate-400 hover:text-slate-600 md:h-10 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <FieldError message={error ?? undefined} />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Accounts are created by your administrator. Contact them if you need access.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
