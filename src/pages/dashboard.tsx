import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Shield, ShieldAlert, Activity, CheckCircle, Network, ArrowRight, Clock3, Radio, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { 
  useGetDashboardSummary, 
  useGetTrafficStats, 
  useGetThreatBreakdown, 
  useListAlerts,
  getGetDashboardSummaryQueryKey,
  getGetTrafficStatsQueryKey,
  getGetThreatBreakdownQueryKey,
  getListAlertsQueryKey
} from "@/lib/api";
import { useEvents } from "@/hooks/use-events";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SEVERITY_COLORS = {
  low: "hsl(var(--success))",
  medium: "hsl(var(--warning))",
  high: "hsl(var(--destructive))",
  critical: "hsl(var(--destructive))" // Will use a brighter red/glow via CSS if possible
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function Dashboard() {
  useEvents();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { refetchInterval: 5000, queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: traffic, isLoading: loadingTraffic } = useGetTrafficStats(
    { minutes: 60 },
    { query: { refetchInterval: 5000, queryKey: getGetTrafficStatsQueryKey({ minutes: 60 }) } }
  );

  const { data: threats, isLoading: loadingThreats } = useGetThreatBreakdown({
    query: { refetchInterval: 10000, queryKey: getGetThreatBreakdownQueryKey() }
  });

  const { data: recentAlerts, isLoading: loadingAlerts } = useListAlerts(
    { limit: 5 },
    { query: { refetchInterval: 5000, queryKey: getListAlertsQueryKey({ limit: 5 }) } }
  );

  const formattedTraffic = useMemo(() => {
    if (!traffic) return [];
    return traffic.map(t => ({
      ...t,
      timeLabel: format(new Date(t.timestamp), "HH:mm"),
    }));
  }, [traffic]);

  const pieData = useMemo(() => {
    if (!threats?.bySeverity) return [];
    return threats.bySeverity.map(s => ({
      name: s.severity,
      value: s.count,
      color: SEVERITY_COLORS[s.severity as keyof typeof SEVERITY_COLORS] || "hsl(var(--muted))"
    }));
  }, [threats]);

  const posture = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    (threats?.bySeverity ?? []).forEach((item) => {
      if (item.severity in counts) counts[item.severity as keyof typeof counts] = item.count;
    });
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const weighted = counts.critical * 12 + counts.high * 6 + counts.medium * 2 + counts.low * 0.5;
    return Math.max(0, Math.min(100, Math.round(100 - (total ? (weighted / (total * 12)) * 100 : 0))));
  }, [threats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold uppercase tracking-wider text-foreground">Command Center</h2>
          <p className="text-muted-foreground font-mono text-sm">REAL-TIME INTRUSION DETECTION SYSTEM</p>
        </div>
        
        {summary?.uptime && (
          <div className="bg-background/80 border border-border px-4 py-2 rounded-md flex items-center gap-3 backdrop-blur-sm">
            <Activity className="w-4 h-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono">SYSTEM UPTIME</span>
              <span className="text-xs font-mono font-bold text-foreground">{summary.uptime}</span>
            </div>
          </div>
        )}
      </div>

      {/* Live incident ticker */}
      <div className="overflow-hidden rounded-md border border-primary/20 bg-primary/5" data-testid="dashboard-live-ticker">
        <div className="flex min-w-max items-center">
          <div className="z-10 flex items-center gap-2 border-r border-primary/20 bg-card px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-primary">
            <Radio className="h-3.5 w-3.5" /> Live incident feed
          </div>
          <div className="ops-ticker-track flex items-center">
            {[...(recentAlerts ?? []), ...(recentAlerts ?? [])].map((alert, index) => (
              <div key={`${alert.id}-${index}`} className="flex items-center gap-2 px-5 py-2 text-[10px] font-mono text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${alert.severity === "critical" ? "bg-destructive" : "bg-primary"}`} />
                <span className="uppercase text-foreground">{alert.type.replace("_", " ")}</span>
                <span>{alert.sourceIp}</span>
                <span className="text-border">→</span>
                <span>{alert.targetIp}</span>
              </div>
            ))}
            {(!recentAlerts || recentAlerts.length === 0) && <div className="px-5 py-2 text-[10px] font-mono text-muted-foreground">Awaiting first detection from telemetry bus</div>}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Alerts (24h)" 
          value={summary?.totalAlerts ?? 0} 
          icon={ShieldAlert}
          loading={loadingSummary}
        />
        <MetricCard 
          title="Active Threats" 
          value={summary?.activeThreats ?? 0} 
          icon={Activity}
          glow={summary?.activeThreats && summary.activeThreats > 0 ? "warning" : undefined}
          loading={loadingSummary}
        />
        <MetricCard 
          title="Critical Alerts" 
          value={summary?.criticalCount ?? 0} 
          icon={AlertTriangleIcon}
          glow={summary?.criticalCount && summary.criticalCount > 0 ? "destructive" : undefined}
          loading={loadingSummary}
        />
        <MetricCard 
          title="Monitored Nodes" 
          value={summary?.monitoredNodes ?? 0} 
          icon={Network}
          glow="primary"
          loading={loadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <MiniPanel icon={Shield} label="Security posture" value={`${loadingThreats ? "—" : posture}/100`} detail="weighted severity exposure" accent="primary" testId="dashboard-posture" />
        <MiniPanel icon={TrendingDown} label="Acknowledged" value={`${summary?.acknowledgedCount ?? 0}`} detail={`of ${summary?.totalAlerts ?? 0} recorded alerts`} accent="success" testId="dashboard-acknowledged" />
        <MiniPanel icon={Clock3} label="Detection cadence" value={summary?.uptime ?? "—"} detail="sensor uptime / current session" accent="warning" testId="dashboard-cadence" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Traffic Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Network Traffic (Packets/sec)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loadingTraffic ? (
                <SkeletonChart />
              ) : formattedTraffic.length === 0 ? (
                <EmptyState message="No traffic data available" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formattedTraffic} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPackets" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="timeLabel" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                      minTickGap={30}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="packetsPerSec" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorPackets)" 
                      activeDot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Threat Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Threats by Severity</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="h-[300px] w-full relative">
              {loadingThreats ? (
                <SkeletonChart />
              ) : pieData.length === 0 ? (
                <EmptyState message="No active threats" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                    <span className="text-3xl font-display font-bold text-foreground">
                      {summary?.activeThreats || 0}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Active</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Threat by Type Bar Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Threat Signatures Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {loadingThreats ? (
                <SkeletonChart />
              ) : !threats?.byType || threats.byType.length === 0 ? (
                <EmptyState message="No threat signatures detected" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={threats.byType} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="type" 
                      type="category" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]}>
                      {threats.byType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts Feed */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Recent Activity</CardTitle>
            <Link to="/alerts" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" data-testid="link-dashboard-alerts">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {loadingAlerts ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="w-2 h-8 bg-muted rounded-sm animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-2 w-1/2 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !recentAlerts || recentAlerts.length === 0 ? (
              <EmptyState message="No recent activity" icon={CheckCircle} />
            ) : (
              <div className="space-y-3">
                {recentAlerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className="flex flex-col gap-1.5 p-3 rounded-md border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ backgroundColor: SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS] }} 
                        />
                        <span className="text-xs font-display font-medium uppercase truncate max-w-[150px]">
                          {alert.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {format(new Date(alert.detectedAt), "HH:mm:ss")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {alert.sourceIp} &rarr; {alert.targetIp}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Subcomponents

function MetricCard({ title, value, icon: Icon, glow, loading }: { title: string, value: number, icon: any, glow?: "primary" | "warning" | "destructive" | undefined, loading?: boolean }) {
  return (
    <Card glow={glow}>
      <CardContent className="p-6 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-mono text-muted-foreground uppercase">{title}</p>
          {loading ? (
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-display font-bold">{value}</p>
          )}
        </div>
        <div className={`p-3 rounded-full bg-background border border-border ${glow ? `glow-border-${glow} bg-${glow}/10` : ''}`}>
          <Icon className={`w-6 h-6 ${glow ? `text-${glow}` : 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniPanel({ icon: Icon, label, value, detail, accent, testId }: { icon: any; label: string; value: string; detail: string; accent: "primary" | "success" | "warning"; testId: string }) {
  return (
    <div className="group flex items-center gap-4 rounded-md border border-border bg-card/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card" data-testid={testId}>
      <div className={`rounded-md border border-${accent}/20 bg-${accent}/10 p-2.5 text-${accent}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-display font-bold text-foreground" data-testid={`${testId}-value`}>{value}</p>
        <p className="mt-0.5 truncate text-[10px] font-mono text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function AlertTriangleIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SkeletonChart() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/10 rounded-md border border-dashed border-border">
      <div className="w-1/2 h-1/2 bg-muted/20 animate-pulse rounded-md" />
    </div>
  );
}

function EmptyState({ message, icon: Icon = Shield }: { message: string, icon?: any }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3 min-h-[150px]">
      <Icon className="w-8 h-8 opacity-50" />
      <p className="text-sm font-mono">{message}</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border p-3 rounded-md shadow-xl backdrop-blur-sm">
        <p className="text-xs font-mono font-bold mb-2 text-foreground">{label || payload[0].name}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs font-mono">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="text-foreground font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
