import { useState, useCallback, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterField } from "@/components/ui/FilterField";
import {
  Activity,
  Database,
  Server,
  Timer,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Save,
  Clock,
  ShieldCheck,
  HardDrive,
  Zap,
  Network,
  Gauge,
  Users,
  Table2,
  Layers,
} from "lucide-react";
import {
  fetchHealth,
  fetchSessionTimeout,
  updateSessionTimeout,
} from "@/features/settings/api";
import type { HealthStatus } from "@/features/settings/types";

const TABS = [
  { id: "session", label: "Session & Security" },
  { id: "health", label: "System Health" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TIMEOUT_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
];

type StatusLevel =
  | "healthy"
  | "warning"
  | "unhealthy"
  | "not-configured"
  | "unknown";

function statusLevel(status: string): StatusLevel {
  const s = status?.toLowerCase() ?? "";
  if (s === "healthy") return "healthy";
  if (s === "warning") return "warning";
  if (s === "not-configured") return "not-configured";
  if (s === "unhealthy") return "unhealthy";
  return "unknown";
}

const STATUS_STYLES: Record<
  StatusLevel,
  { dot: string; text: string; label: string }
> = {
  healthy: {
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    label: "Healthy",
  },
  warning: {
    dot: "bg-amber-500",
    text: "text-amber-600",
    label: "Warning",
  },
  unhealthy: {
    dot: "bg-destructive",
    text: "text-destructive",
    label: "Unhealthy",
  },
  "not-configured": {
    dot: "bg-slate-400",
    text: "text-muted-foreground",
    label: "Not configured",
  },
  unknown: {
    dot: "bg-slate-400",
    text: "text-muted-foreground",
    label: "Unknown",
  },
};

function StatusBadge({ status }: { status: string }) {
  const level = statusLevel(status);
  const s = STATUS_STYLES[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-semibold",
        s.text,
      )}
    >
      <span className={cn("relative flex h-2.5 w-2.5")}>
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
            s.dot,
          )}
        />
        <span
          className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", s.dot)}
        />
      </span>
      {s.label}
    </span>
  );
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return `${Math.round(ms)} ms`;
}

function formatSize(sizeMb: number | null | undefined): string {
  if (sizeMb == null) return "—";
  if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(2)} GB`;
  return `${sizeMb.toFixed(1)} MB`;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function formatChecked(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Service overview card ───────────────────────────────────────────────────
function ServiceCard({
  title,
  icon: Icon,
  status,
  metrics,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
  metrics: { label: string; value: string }[];
}) {
  const level = statusLevel(status);
  const s = STATUS_STYLES[level];

  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              {title}
            </span>
          </div>
        </div>

        <StatusBadge status={status} />

        <div className="grid grid-cols-2 gap-x-3 gap-y-3 pt-1">
          {metrics.map((m) => (
            <div key={m.label} className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {m.label}
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {m.value}
              </p>
            </div>
          ))}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Status
            </p>
            <p className={cn("text-sm font-semibold", s.text)}>{s.label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Full System Health dashboard ────────────────────────────────────────────
function SystemHealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await fetchHealth();
      setHealth(result);
    } catch {
      setError(
        "Unable to reach the health endpoint. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              Unable to load system health
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {error}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  const overall = statusLevel(health.overall);
  const overallStyle = STATUS_STYLES[overall];

  const overallLabel =
    overall === "healthy"
      ? "All systems operational"
      : overall === "warning"
        ? "Some services degraded"
        : "System unavailable";

  return (
    <div className="space-y-6">
      {/* ── Page row: title + refresh ──────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            System Health
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor the availability and infrastructure health of NXPERT EON.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw
            className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Checking..." : "Refresh"}
        </Button>
      </div>

      {/* ── Overview service cards ─────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ServiceCard
          title="API Server"
          icon={Server}
          status={health.api.status}
          metrics={[
            {
              label: "Response Time",
              value: formatMs(health.api.responseTimeMs),
            },
            { label: "Uptime", value: health.api.uptime || "—" },
            { label: "Version", value: health.api.version || "—" },
            { label: "Environment", value: health.api.environment || "—" },
          ]}
        />
        <ServiceCard
          title="Database"
          icon={Database}
          status={health.database.status}
          metrics={[
            {
              label: "Response Time",
              value: formatMs(health.database.responseTimeMs),
            },
            { label: "Size", value: formatSize(health.database.sizeMb) },
            { label: "Tables", value: formatNumber(health.database.tables) },
            {
              label: "Connections",
              value: formatNumber(health.database.connections),
            },
          ]}
        />
        <ServiceCard
          title="Node-RED"
          icon={Network}
          status={health.nodeRed.status}
          metrics={[
            {
              label: "Response Time",
              value: formatMs(health.nodeRed.responseTimeMs),
            },
            {
              label: "Endpoint",
              value:
                health.nodeRed.status === "healthy"
                  ? "Connected"
                  : health.nodeRed.endpoint
                    ? "Reachable"
                    : "—",
            },
            {
              label: "Host",
              value: health.nodeRed.endpoint
                ? health.nodeRed.endpoint
                    .replace(/^https?:\/\//, "")
                    .replace(/\/$/, "")
                : "—",
            },
          ]}
        />
        <Card
          className={cn(
            "transition-shadow hover:shadow-card-hover",
            overall === "unhealthy" && "border-destructive/40",
          )}
        >
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                Overall System
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("relative flex h-3 w-3")}>
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
                    overallStyle.dot,
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-3 w-3 rounded-full",
                    overallStyle.dot,
                  )}
                />
              </span>
              <span className={cn("text-sm font-bold", overallStyle.text)}>
                {overallLabel}
              </span>
            </div>
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">API Server</span>
                <StatusBadge status={health.api.status} />
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Database</span>
                <StatusBadge status={health.database.status} />
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Node-RED</span>
                <StatusBadge status={health.nodeRed.status} />
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                <span>Last checked</span>
                <span className="font-medium">
                  {formatChecked(health.checkedAt)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Database details ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            Database Details
          </CardTitle>
          <CardDescription>
            Read-only SQL Server metrics collected during the health check.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Database Size
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {formatSize(health.database.sizeMb)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Tables
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {formatNumber(health.database.tables)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Connections
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {formatNumber(health.database.connections)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Response
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {formatMs(health.database.responseTimeMs)}
              </p>
            </div>
          </div>
          {health.database.version && (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              SQL Server version:{" "}
              <span className="font-medium text-foreground">
                {health.database.version}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Service availability ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            Service Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/60 rounded-xl border border-border/60">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    API Server
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMs(health.api.responseTimeMs)} · uptime{" "}
                    {health.api.uptime || "—"}
                  </p>
                </div>
              </div>
              <StatusBadge status={health.api.status} />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Database
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMs(health.database.responseTimeMs)} ·{" "}
                    {formatSize(health.database.sizeMb)} ·{" "}
                    {formatNumber(health.database.tables)} tables
                  </p>
                </div>
              </div>
              <StatusBadge status={health.database.status} />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Network className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Node-RED
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {health.nodeRed.status === "not-configured"
                      ? "Not configured"
                      : `${formatMs(health.nodeRed.responseTimeMs)}${health.nodeRed.endpoint ? ` · ${health.nodeRed.endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : ""}`}
                  </p>
                </div>
              </div>
              <StatusBadge status={health.nodeRed.status} />
            </div>
          </div>
          <p className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            Last checked:{" "}
            <span className="font-medium text-foreground">
              {formatChecked(health.checkedAt)}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SessionTimeoutCard() {
  const [minutes, setMinutes] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSessionTimeout()
      .then((r) => {
        if (!cancelled) setMinutes(r.minutes);
      })
      .catch(() => {
        /* keep default 30 */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateSessionTimeout(minutes);
      setMessage({
        type: "success",
        text: "Session timeout updated successfully.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Failed to save session timeout. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-primary" />
          Session Timeout
        </CardTitle>
        <CardDescription>
          Automatically sign out inactive users after the configured period.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full sm:w-64" />
            <Skeleton className="h-9 w-36" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Timeout
              </label>
              <div className="max-w-xs">
                <FilterField icon={Timer}>
                  <select
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer"
                  >
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3.5 py-2.5 text-[13px] text-muted-foreground">
              <Timer className="h-4 w-4 shrink-0 text-primary/70" />
              Automatically sign out when there is no activity.
            </div>

            {message && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] animate-in fade-in",
                  message.type === "success"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                {message.text}
              </div>
            )}

            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  usePageTitle("Settings");
  const [activeTab, setActiveTab] = useState<TabId>("session");

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="settings-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
              <pattern
                id="settings-dots"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#settings-grid)" />
            <rect width="100%" height="100%" fill="url(#settings-dots)" />
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
            <line
              x1="100%"
              y1="0"
              x2="0"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-inner">
              <img
                src="/plan.png"
                alt="Settings"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              Settings
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage system health and authentication session behavior
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <ShieldCheck className="h-3 w-3" />
                Session &amp; Security
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Activity className="h-3 w-3" />
                System Health
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-sm border border-white/20">
              <img
                src="/logo_npax.png"
                alt="ISUZU"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "session" && (
        <div className="max-w-2xl">
          <SessionTimeoutCard />
        </div>
      )}

      {activeTab === "health" && <SystemHealthDashboard />}
    </div>
  );
}
