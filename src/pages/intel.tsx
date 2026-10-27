import { useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, ArrowUpRight, Download, FileJson, FileText, Flag, Gauge, GitBranch, Globe2, Radar, Shield, ShieldAlert, Target, Wifi } from "lucide-react";
import { getGetDashboardSummaryQueryKey, getGetThreatBreakdownQueryKey, getListAlertsQueryKey, useGetDashboardSummary, useGetThreatBreakdown, useListAlerts } from "@/lib/api";
import { useEvents } from "@/hooks/use-events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const severityWeight: Record<string, number> = { critical: 12, high: 6, medium: 2, low: 0.5 };
const severityColor: Record<string, string> = {
  critical: "text-destructive bg-destructive/10 border-destructive/25",
  high: "text-orange-300 bg-orange-400/10 border-orange-300/25",
  medium: "text-warning bg-warning/10 border-warning/25",
  low: "text-success bg-success/10 border-success/25",
};

const techniques = [
  { id: "T1046", name: "Network Service Scanning", tactic: "Discovery", type: "port_scan", color: "primary", icon: Radar },
  { id: "T1110", name: "Brute Force", tactic: "Credential Access", type: "brute_force", color: "warning", icon: ShieldAlert },
  { id: "T1557.002", name: "ARP Cache Poisoning", tactic: "Credential Access", type: "arp_spoof", color: "destructive", icon: GitBranch },
  { id: "T1498", name: "Network Denial of Service", tactic: "Impact", type: "dos_flood", color: "accent", icon: Wifi },
] as const;

export default function Intel() {
  useEvents();
  const alertQuery = useListAlerts({ limit: 100 }, { query: { refetchInterval: 5000, queryKey: getListAlertsQueryKey({ limit: 100 }) } });
  const threatQuery = useGetThreatBreakdown({ query: { refetchInterval: 10000, queryKey: getGetThreatBreakdownQueryKey() } });
  const summaryQuery = useGetDashboardSummary({ query: { refetchInterval: 5000, queryKey: getGetDashboardSummaryQueryKey() } });
  const alerts = alertQuery.data ?? [];
  const loading = alertQuery.isLoading || threatQuery.isLoading || summaryQuery.isLoading;
  const hasError = alertQuery.isError || threatQuery.isError || summaryQuery.isError;

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    (threatQuery.data?.bySeverity ?? []).forEach((item) => { counts[item.severity] = item.count; });
    return counts;
  }, [threatQuery.data]);

  const posture = useMemo(() => {
    const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
    const exposure = Object.entries(severityCounts).reduce((sum, [severity, count]) => sum + count * (severityWeight[severity] ?? 0), 0);
    const score = Math.max(0, Math.min(100, Math.round(100 - (total ? (exposure / (total * 12)) * 100 : 0))));
    return { score, total, exposure };
  }, [severityCounts]);

  const techniqueCounts = useMemo(() => {
    const byType = new Map((threatQuery.data?.byType ?? []).map((item) => [item.type, item.count]));
    return techniques.map((technique) => ({ ...technique, count: byType.get(technique.type) ?? alerts.filter((alert) => alert.type === technique.type).length }));
  }, [alerts, threatQuery.data]);

  const sourceIocs = useMemo(() => {
    const map = new Map<string, { ip: string; frequency: number; latest: string; targets: Set<string>; critical: boolean }>();
    alerts.forEach((alert) => {
      const existing = map.get(alert.sourceIp) ?? { ip: alert.sourceIp, frequency: 0, latest: alert.detectedAt, targets: new Set<string>(), critical: false };
      existing.frequency += 1;
      existing.targets.add(alert.targetIp);
      existing.critical = existing.critical || alert.severity === "critical";
      if (new Date(alert.detectedAt) > new Date(existing.latest)) existing.latest = alert.detectedAt;
      map.set(alert.sourceIp, existing);
    });
    return [...map.values()].sort((a, b) => b.frequency - a.frequency).slice(0, 8);
  }, [alerts]);

  const timeline = useMemo(() => [...alerts].sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()).slice(-8), [alerts]);
  const latestAlert = [...alerts].sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())[0];

  const download = (kind: "csv" | "json") => {
    const rows = alerts.map((alert) => ({
      id: alert.id, detectedAt: alert.detectedAt, severity: alert.severity, type: alert.type,
      sourceIp: alert.sourceIp, targetIp: alert.targetIp, targetNode: alert.targetNode ?? "", message: alert.message, acknowledged: alert.acknowledged,
    }));
    const content = kind === "json"
      ? JSON.stringify(rows, null, 2)
      : [
        "id,detectedAt,severity,type,sourceIp,targetIp,targetNode,message,acknowledged",
        ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
    const blob = new Blob([content], { type: kind === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nids-telemetry-${format(new Date(), "yyyyMMdd-HHmmss")}.${kind}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-primary"><CrosshairIcon /> Intelligence / Workbench</div>
          <h2 className="text-3xl font-display font-bold uppercase tracking-wider text-foreground md:text-4xl">Threat Intelligence</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Analyst view of active detections, source reputation, and mapped attack behavior across the lab perimeter.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2 text-[10px] font-mono text-muted-foreground" data-testid="status-intel-refresh">
          <Activity className="h-3.5 w-3.5 text-success" /> LIVE DATA / 5S REFRESH
        </div>
      </div>

      {hasError ? (
        <Card className="border-destructive/30 bg-destructive/5" data-testid="state-intel-error">
          <CardContent className="flex items-center gap-3 p-6"><AlertTriangle className="h-5 w-5 text-destructive" /><div><p className="font-display uppercase">Telemetry unavailable</p><p className="text-sm text-muted-foreground">The workbench could not read one or more live sources. Retry from the browser to resume the analyst view.</p></div></CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="workbench-panel overflow-hidden" data-testid="panel-security-posture">
              <CardContent className="p-5 md:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full border-[10px] border-primary/15 bg-primary/5" style={{ background: `conic-gradient(hsl(var(--primary)) ${posture.score * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card">
                      {loading ? <div className="h-9 w-16 animate-pulse rounded bg-muted" /> : <span className="text-4xl font-display font-bold text-primary" data-testid="text-posture-score">{posture.score}</span>}
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">posture / 100</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div><p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Explainable security posture</p><h3 className="mt-1 text-xl font-display uppercase">Risk-weighted exposure</h3></div>
                    <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">Score starts at 100 and subtracts observed severity exposure. Critical detections carry 12 points, high 6, medium 2, and low 0.5 per event, normalized against the maximum critical profile.</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-mono text-muted-foreground">
                      <span><b className="text-foreground">{posture.total}</b> observed events</span><span><b className="text-destructive">{severityCounts["critical"]}</b> critical</span><span><b className="text-warning">{severityCounts["high"]}</b> high</span><span><b className="text-primary">{posture.exposure.toFixed(1)}</b> weighted exposure</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="workbench-panel" data-testid="panel-coverage">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /> Coverage snapshot</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <CoverageLine label="Monitored nodes" value={summaryQuery.data?.monitoredNodes ?? 0} detail="lab assets under watch" />
                <CoverageLine label="Acknowledged" value={summaryQuery.data?.acknowledgedCount ?? 0} detail={`${summaryQuery.data?.totalAlerts ?? 0} total alerts`} />
                <CoverageLine label="Top observed behavior" value={summaryQuery.data?.topAttackType?.replace(/_/g, " ") ?? "—"} detail="from dashboard summary" text />
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3" data-testid="section-mitre-techniques">
            <SectionHeading eyebrow="ATT&CK / OBSERVED BEHAVIOR" title="Technique coverage" icon={Target} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {techniqueCounts.map((technique) => {
                const Icon = technique.icon;
                return <div key={technique.id} className="group rounded-md border border-border bg-card/75 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5" data-testid={`card-technique-${technique.id.replace(".", "-")}`}>
                  <div className="flex items-start justify-between"><div className="rounded border border-primary/20 bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><span className="font-mono text-[10px] text-muted-foreground">{technique.id}</span></div>
                  <p className="mt-4 text-sm font-display uppercase leading-tight">{technique.name}</p>
                  <div className="mt-2 flex items-center justify-between"><span className="text-[10px] font-mono uppercase text-muted-foreground">{technique.tactic}</span><span className="text-lg font-display text-primary" data-testid={`text-technique-count-${technique.id.replace(".", "-")}`}>{loading ? "—" : technique.count}</span></div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, technique.count * 12)}%` }} /></div>
                </div>;
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="workbench-panel" data-testid="panel-ioc-table">
              <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" /> Source IP observables</CardTitle><p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Local reputation derived from visible detections</p></div><Badge variant="outline">{sourceIocs.length} sources</Badge></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs"><thead className="border-y border-border bg-muted/20 text-[10px] font-mono uppercase text-muted-foreground"><tr><th className="px-5 py-3">Source IP</th><th className="px-3 py-3">Frequency</th><th className="px-3 py-3">Latest seen</th><th className="px-3 py-3">Targets</th><th className="px-5 py-3 text-right">Reputation</th></tr></thead><tbody>
                    {loading ? [1, 2, 3].map((item) => <tr key={item} className="border-b border-border/60"><td colSpan={5} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-muted/60" /></td></tr>) : sourceIocs.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-muted-foreground"><Shield className="mx-auto mb-2 h-6 w-6 opacity-30" /><p className="font-mono text-xs">No source observables in current window</p></td></tr> : sourceIocs.map((ioc) => {
                      const reputation = ioc.critical ? "CRITICAL SOURCE" : ioc.frequency >= 5 ? "HIGH VOLUME" : "OBSERVED";
                      return <tr key={ioc.ip} className="border-b border-border/60 transition-colors hover:bg-primary/5" data-testid={`row-ioc-${ioc.ip.replace(/[.:]/g, "-")}`}><td className="px-5 py-3 font-mono text-primary">{ioc.ip}</td><td className="px-3 py-3 font-display text-base">{ioc.frequency}</td><td className="px-3 py-3 text-muted-foreground">{formatDistanceToNow(new Date(ioc.latest), { addSuffix: true })}</td><td className="px-3 py-3 font-mono text-muted-foreground" title={[...ioc.targets].join(", ")}>{ioc.targets.size} asset{ioc.targets.size === 1 ? "" : "s"}</td><td className="px-5 py-3 text-right"><span className={`rounded border px-2 py-1 text-[9px] font-mono tracking-wider ${reputation === "CRITICAL SOURCE" ? severityColor["critical"] : reputation === "HIGH VOLUME" ? severityColor["high"] : "text-primary bg-primary/10 border-primary/25"}`}>{reputation}</span></td></tr>;
                    })}
                  </tbody></table>
                </div>
              </CardContent>
            </Card>

            <Card className="workbench-panel" data-testid="panel-attack-chain">
              <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /> Attack chain</CardTitle><p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Recent detections / chronological</p></CardHeader>
              <CardContent>
                {loading ? <div className="space-y-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-8 animate-pulse rounded bg-muted/50" />)}</div> : timeline.length === 0 ? <div className="flex min-h-44 flex-col items-center justify-center text-center text-muted-foreground"><GitBranch className="mb-2 h-7 w-7 opacity-30" /><p className="font-mono text-xs">Chain is quiet</p><p className="mt-1 text-xs">New detections will appear here in sequence.</p></div> : <div className="relative ml-2 border-l border-primary/25 pl-5">{timeline.map((alert, index) => <div key={alert.id} className="relative mb-5 last:mb-0" data-testid={`timeline-event-${alert.id}`}><span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card ${alert.severity === "critical" ? "bg-destructive" : "bg-primary"}`} /><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-display uppercase">{alert.type.replace(/_/g, " ")}</p><p className="mt-0.5 text-[10px] font-mono text-muted-foreground">{alert.sourceIp} → {alert.targetIp}</p></div><time className="shrink-0 text-[10px] font-mono text-muted-foreground">{format(new Date(alert.detectedAt), "HH:mm:ss")}</time></div><div className="mt-1 text-[10px] text-muted-foreground">{index === 0 ? "Initial observation" : alert.message}</div></div>)}</div>}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="workbench-panel" data-testid="panel-export">
              <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-4 w-4 text-primary" /> Telemetry export</CardTitle><p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Download the visible 100-event analyst window</p></CardHeader>
              <CardContent className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => download("csv")} disabled={loading || alerts.length === 0} data-testid="button-export-csv"><FileText className="mr-2 h-4 w-4" /> Export CSV</Button><Button variant="outline" onClick={() => download("json")} disabled={loading || alerts.length === 0} data-testid="button-export-json"><FileJson className="mr-2 h-4 w-4" /> Export JSON</Button></CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5" data-testid="panel-analyst-handoff">
              <CardHeader><CardTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> Analyst handoff</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded border border-border/70 bg-background/30 p-3 text-sm leading-relaxed text-foreground" data-testid="text-incident-summary">
                  {latestAlert ? `Live review: ${alerts.length} detections are visible, led by ${latestAlert.severity} ${latestAlert.type.replace(/_/g, " ")} activity from ${latestAlert.sourceIp} toward ${latestAlert.targetIp}. Current posture is ${posture.score}/100 with ${summaryQuery.data?.activeThreats ?? 0} active threats; validate the source and scope before containment.` : "Live review: no detections are currently visible in the analyst window. Maintain monitoring and validate telemetry coverage before closing the review."}
                </p>
                <div className="flex items-start gap-2 text-[10px] font-mono leading-relaxed text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /><span>DEMO / LAB DISCLAIMER: This workbench reflects simulated university lab telemetry and local reputation heuristics. Do not treat labels as external threat intelligence or production incident disposition.</span></div>
                <Link to="/alerts" className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-primary hover:text-foreground" data-testid="link-review-alert-log">Review alert log <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function CrosshairIcon() {
  return <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />;
}

function SectionHeading({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: typeof Target }) {
  return <div className="flex items-end justify-between"><div><p className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary">{eyebrow}</p><h3 className="mt-1 flex items-center gap-2 text-xl font-display uppercase">{title} <Icon className="h-4 w-4 text-muted-foreground" /></h3></div></div>;
}

function CoverageLine({ label, value, detail, text = false }: { label: string; value: number | string; detail: string; text?: boolean }) {
  return <div className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0 last:pb-0"><div><p className="text-xs font-display uppercase">{label}</p><p className="mt-1 text-[10px] font-mono text-muted-foreground">{detail}</p></div><span className={text ? "max-w-[120px] text-right text-xs font-mono uppercase text-primary" : "text-2xl font-display text-primary"} data-testid={`value-coverage-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</span></div>;
}