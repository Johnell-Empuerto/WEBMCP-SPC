import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  User,
  Lock,
  ShieldCheck,
  Info,
  Factory,
  LineChart,
  Database,
} from "lucide-react";

const REMEMBERED_USERCODE_KEY = "nxpert_remembered_usercode";

const capabilities = [
  { icon: Factory, label: "Production Management" },
  { icon: LineChart, label: "SPC & Charts" },
  { icon: ShieldCheck, label: "Quality Control" },
  { icon: Database, label: "Master Data" },
];

export default function LoginPage() {
  usePageTitle("Login");
  const { login } = useAuth();
  const [usercode, setUsercode] = useState(
    () => localStorage.getItem(REMEMBERED_USERCODE_KEY) ?? "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem(REMEMBERED_USERCODE_KEY) !== null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionMessage] = useState(
    () => sessionStorage.getItem("nxpert_session_message") ?? "",
  );

  useEffect(() => {
    sessionStorage.removeItem("nxpert_session_message");
  }, []);

  const handleRememberMeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
    if (!e.target.checked) {
      localStorage.removeItem(REMEMBERED_USERCODE_KEY);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usercode.trim()) {
      setError("Enter your User Code to continue.");
      return;
    }
    if (!password.trim()) {
      setError("Enter your password to continue.");
      return;
    }
    setIsLoading(true);
    try {
      await login(usercode.trim(), password, rememberMe);
      // Client-side convenience only — remember the user code for the next visit.
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_USERCODE_KEY, usercode.trim());
      } else {
        localStorage.removeItem(REMEMBERED_USERCODE_KEY);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 lg:flex-row">
      {/* ── LEFT — Manufacturing visual (desktop 55%) ─────────────── */}
      <div className="relative hidden lg:block lg:w-[55%] min-h-screen overflow-hidden bg-slate-900">
        <img
          src="/login-bg.png"
          alt="Manufacturing background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Restrained blue overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-[#00365f]/40 to-[#005B96]/20" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/60 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          {/* Branding */}
          <img
            src="/logo-nxpert-eon.png"
            alt="NXPERT EON SPC"
            className="h-auto w-full max-w-[220px] object-contain"
          />

          {/* Statement */}
          <div className="max-w-md">
            <h1 className="text-3xl xl:text-4xl font-semibold tracking-tight text-white leading-tight">
              Production intelligence for modern manufacturing
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Monitor production, quality, SPC, and master data across your
              plant — in one platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {capabilities.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur-sm"
                >
                  <c.icon className="h-3.5 w-3.5 text-white/70" />
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-white/40">
            N-PAX CORPORATION PHILIPPINES
          </p>
        </div>
      </div>

      {/* ── RIGHT — Login panel (desktop 45%) ─────────────────────── */}
      <div className="flex flex-1 flex-col lg:w-[45%] lg:min-h-screen">
        {/* Compact mobile banner */}
        <div className="relative lg:hidden h-44 overflow-hidden bg-slate-900">
          <img
            src="/login-bg.png"
            alt="Manufacturing background"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-slate-950/80" />
          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <img
              src="/logo-nxpert-eon.png"
              alt="NXPERT EON SPC"
              className="h-auto w-full max-w-[180px] object-contain"
            />
          </div>
        </div>

        {/* Login form — vertically centered */}
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="w-full max-w-[420px]">
            <div className="mb-6">
              <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-foreground">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to access your production platform
              </p>
            </div>

            {sessionMessage && (
              <div className="mb-5 flex items-start gap-3 rounded-lg bg-primary/10 p-3.5 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <Info size={16} className="mt-0.5 shrink-0 text-primary" />
                <p className="text-[13px] leading-relaxed text-primary/90">
                  {sessionMessage}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="usercode"
                  className="text-[13px] font-semibold text-foreground"
                >
                  User Code
                </Label>
                <div className="relative">
                  <User
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/70"
                    aria-hidden
                  />
                  <Input
                    id="usercode"
                    type="text"
                    placeholder="Enter your user code"
                    value={usercode}
                    onChange={(e) => setUsercode(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    autoComplete="username"
                    maxLength={12}
                    className="h-12 pl-11 text-[15px] focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-[13px] font-semibold text-foreground"
                >
                  Password
                </Label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/70"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    maxLength={16}
                    className="login-password-field h-12 pl-11 pr-12 text-[15px] focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember me / Forgot password */}
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={handleRememberMeChange}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  Remember me
                </label>

                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-[13px] font-medium text-primary transition-colors hover:text-primary/80 hover:underline underline-offset-4"
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent hideDefaultClose className="max-w-md">
                    <DialogHeader className="sm:text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                        <Lock className="h-5 w-5" aria-hidden />
                      </div>
                      <DialogTitle className="text-lg">
                        Password assistance
                      </DialogTitle>
                      <DialogDescription className="leading-relaxed">
                        Please contact your system administrator to reset your
                        password.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center">
                      <DialogClose asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                        >
                          Close
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-3.5 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle
                    size={16}
                    className="mt-0.5 shrink-0 text-destructive"
                  />
                  <div>
                    <p className="font-semibold text-destructive">
                      Unable to sign in
                    </p>
                    <p className="text-destructive/80 mt-0.5 text-[13px]">
                      {error}
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-[50px] text-[15px] font-semibold rounded-lg group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Subtle footer */}
        <footer className="px-6 pb-8 text-center lg:pb-9">
          <p className="text-xs font-medium text-muted-foreground/80">
            NXPERT EON · Industrial Manufacturing Platform
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/60">
            © 2026 · All rights reserved
          </p>
        </footer>
      </div>
    </div>
  );
}
