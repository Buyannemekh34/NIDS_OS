/**
 * In-browser replacement for the old Express + Postgres API (@workspace/api-client-react).
 * Keeps the same hook names/signatures so pages work unchanged. Data is synthetic demo
 * telemetry persisted in localStorage; real events can be ingested from the local sensor.
 */
import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";

export const AlertType = { port_scan: "port_scan", brute_force: "brute_force", arp_spoof: "arp_spoof", dos_flood: "dos_flood" } as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];
export const AlertSeverity = { low: "low", medium: "medium", high: "high", critical: "critical" } as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];
export const SimulationInputAttackType = AlertType;
export type SimulationInputAttackType = AlertType;
export const SimulationInputIntensity = { low: "low", medium: "medium", high: "high" } as const;
export type SimulationInputIntensity = (typeof SimulationInputIntensity)[keyof typeof SimulationInputIntensity];
export const ListAlertsType = AlertType;
export type ListAlertsType = AlertType;
export const ListAlertsSeverity = AlertSeverity;
export type ListAlertsSeverity = AlertSeverity;
export const ListAlertsAcknowledged = { true: "true", false: "false" } as const;
export type ListAlertsAcknowledged = "true" | "false";

export type NetworkNodeRole = "client" | "server" | "router" | "gateway";
export type NetworkNodeStatus = "online" | "offline" | "suspicious" | "under_attack";
export interface NetworkNode { id: string; name: string; ip: string; role: NetworkNodeRole; status: NetworkNodeStatus; os: string; alertCount?: number }
export interface Alert {
  id: string; type: AlertType; severity: AlertSeverity; sourceIp: string; targetIp: string;
  targetNode?: string | null; message: string; detectedAt: string; acknowledged: boolean;
  packetCount?: number | null; portCount?: number | null; simulationId?: string | null;
}
export interface SimulationRun {
  id: string; attackType: AlertType; sourceIp: string; targetIp: string; targetNodeId?: string;
  startedAt: string; completedAt?: string | null; status: "running" | "complete" | "failed";
  alertsGenerated: number; intensity: SimulationInputIntensity;
}
export interface TrafficPoint { timestamp: string; packetsPerSec: number; bytesPerSec: number; isAnomaly: boolean }
export interface DashboardSummary {
  totalAlerts: number; activeThreats: number; criticalCount: number; acknowledgedCount: number;
  alertsLast24h: number; monitoredNodes: number; uptime: string; topAttackType?: string | null;
}
export interface ThreatBreakdown { byType: { type: string; count: number }[]; bySeverity: { severity: string; count: number }[] }
export type ListAlertsParams = { type?: AlertType; severity?: AlertSeverity; acknowledged?: ListAlertsAcknowledged; limit?: number };
export type GetTrafficStatsParams = { minutes?: number };
export interface SensorAlertInput {
  type: AlertType; severity: AlertSeverity; sourceIp: string; targetIp: string;
  targetNode?: string | null; message: string; packetCount?: number | null; portCount?: number | null;
}

// ---------- store ----------
const KEY = "nids-os-store-v1";
const SEED_NODES: NetworkNode[] = [
  { id: "router-1", name: "Core Router", ip: "192.168.1.1", role: "router", status: "online", os: "Cisco IOS 16.9" },
  { id: "gateway-1", name: "Firewall Gateway", ip: "192.168.1.254", role: "gateway", status: "online", os: "pfSense 2.7.0" },
  { id: "webserver-1", name: "Web Server", ip: "192.168.1.10", role: "server", status: "online", os: "Ubuntu 22.04 LTS" },
  { id: "fileserver-1", name: "File Server", ip: "192.168.1.20", role: "server", status: "online", os: "Ubuntu 20.04 LTS" },
  { id: "workstation-1", name: "Workstation-01", ip: "192.168.1.101", role: "client", status: "online", os: "Windows 11 Pro" },
  { id: "workstation-2", name: "Workstation-02", ip: "192.168.1.102", role: "client", status: "online", os: "Windows 10 Pro" },
  { id: "laptop-1", name: "Dev Laptop", ip: "192.168.1.201", role: "client", status: "online", os: "macOS Ventura 13.4" },
];
const EXTERNAL_IPS = ["203.0.113.42", "198.51.100.17", "185.220.101.8", "45.142.212.100", "91.108.4.22", "194.165.16.73", "77.73.133.89", "5.188.87.15"];

type Store = { alerts: Alert[]; nodes: NetworkNode[]; simulations: SimulationRun[] };
const startTime = Date.now();
let store: Store | null = null;
const listeners = new Set<(type: string) => void>();

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)] as T;
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function load(): Store {
  if (store) return store;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) return (store = JSON.parse(raw));
    } catch { /* fall through to fresh store */ }
  }
  store = { alerts: [], nodes: SEED_NODES.map((n) => ({ ...n })), simulations: [] };
  return store;
}
function save(event: string) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* quota */ }
  }
  listeners.forEach((l) => l(event));
}
export function subscribe(fn: (type: string) => void) { listeners.add(fn); return () => listeners.delete(fn); }

function addAlert(p: Omit<Alert, "id" | "detectedAt" | "acknowledged">, idPrefix = "") {
  const s = load();
  const alert: Alert = { ...p, id: idPrefix + uid(), detectedAt: new Date().toISOString(), acknowledged: false };
  s.alerts.unshift(alert);
  s.alerts = s.alerts.slice(0, 1000);
  save("new_alert");
  return alert;
}

export function listAlerts(params: ListAlertsParams = {}): Alert[] {
  return load().alerts
    .filter((a) => (!params.type || a.type === params.type)
      && (!params.severity || a.severity === params.severity)
      && (!params.acknowledged || String(a.acknowledged) === params.acknowledged))
    .slice(0, params.limit ?? 50);
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function countBy<T extends string>(items: Alert[], key: "type" | "severity") {
  const map = new Map<string, number>();
  items.forEach((a) => map.set(a[key], (map.get(a[key]) ?? 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({ [key]: k as T, count }));
}

export function getSummary(): DashboardSummary {
  const s = load(); const a = s.alerts; const dayAgo = Date.now() - 864e5;
  const top = countBy(a, "type")[0] as { type: string } | undefined;
  return {
    totalAlerts: a.length,
    activeThreats: a.filter((x) => !x.acknowledged).length,
    criticalCount: a.filter((x) => x.severity === "critical").length,
    acknowledgedCount: a.filter((x) => x.acknowledged).length,
    alertsLast24h: a.filter((x) => new Date(x.detectedAt).getTime() >= dayAgo).length,
    monitoredNodes: s.nodes.length,
    uptime: formatUptime(Date.now() - startTime),
    topAttackType: top?.type ?? null,
  };
}

export function getTraffic(minutes = 30): TrafficPoint[] {
  const now = Date.now(); const since = now - minutes * 60000;
  const recent = load().alerts.filter((a) => new Date(a.detectedAt).getTime() >= since);
  const pts: TrafficPoint[] = [];
  for (let i = minutes; i >= 0; i--) {
    const t = now - i * 60000;
    const spike = recent.filter((a) => Math.abs(new Date(a.detectedAt).getTime() - t) <= 30000).reduce((sum, a) =>
      sum + (a.type === "dos_flood" ? (a.packetCount ?? 0) / 100 : a.type === "port_scan" ? 200 : a.type === "brute_force" ? 80 : 30), 0);
    const pps = Math.floor(150 + Math.sin((t / 60000) * 0.3) * 40 + Math.random() * 30 + spike);
    pts.push({ timestamp: new Date(t).toISOString(), packetsPerSec: pps, bytesPerSec: Math.floor(pps * (64 + Math.random() * 500)), isAnomaly: spike > 100 });
  }
  return pts;
}

export function listNodes(): NetworkNode[] {
  const s = load();
  return s.nodes.map((n) => ({ ...n, alertCount: s.alerts.filter((a) => a.targetIp === n.ip).length }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sevFor = (i: SimulationInputIntensity, opts: Record<SimulationInputIntensity, AlertSeverity[]>) => pick(opts[i]);
const countFor = (i: SimulationInputIntensity, l: number, m: number, h: number) => (i === "low" ? rint(1, l) : i === "medium" ? rint(l + 1, m) : rint(m + 1, h));
const STD: Record<SimulationInputIntensity, AlertSeverity[]> = { low: ["low", "medium"], medium: ["medium", "high"], high: ["high", "critical"] };

async function runSimulation(sim: SimulationRun, node: NetworkNode) {
  const s = load(); const { sourceIp, targetIp, intensity: i } = sim; const base = { sourceIp, targetIp, targetNode: node.name, simulationId: sim.id };
  const setNode = (status: NetworkNodeStatus) => { const n = s.nodes.find((x) => x.id === node.id); if (n) n.status = status; save("node_status"); };
  setNode("under_attack");
  let n = 0;
  if (sim.attackType === "port_scan") {
    n = countFor(i, 2, 4, 6);
    for (let k = 0; k < n; k++) {
      const portCount = i === "low" ? rint(5, 50) : i === "medium" ? rint(50, 500) : rint(500, 65535);
      addAlert({ ...base, type: "port_scan", severity: sevFor(i, STD), portCount, message: `Port scan detected from ${sourceIp}: ${portCount} ports probed on ${targetIp} (TCP SYN scan)` });
      await sleep(rint(200, 600));
    }
  } else if (sim.attackType === "brute_force") {
    n = countFor(i, 2, 3, 5);
    for (let k = 0; k < n; k++) {
      const svc = pick(["SSH", "FTP", "RDP", "Telnet"]); const att = i === "low" ? rint(10, 50) : i === "medium" ? rint(50, 200) : rint(200, 1000);
      addAlert({ ...base, type: "brute_force", severity: sevFor(i, STD), packetCount: att, message: `Brute-force ${svc} login attempts from ${sourceIp}: ${att} failed attempts on ${targetIp}` });
      await sleep(rint(300, 800));
    }
  } else if (sim.attackType === "arp_spoof") {
    n = countFor(i, 1, 2, 3);
    for (let k = 0; k < n; k++) {
      const mac = Array.from({ length: 6 }, () => rint(0, 255).toString(16).padStart(2, "0")).join(":");
      addAlert({ ...base, type: "arp_spoof", severity: i === "high" ? "critical" : pick(["high", "critical"] as AlertSeverity[]), message: `ARP spoofing detected: ${sourceIp} is claiming MAC ${mac} (legitimate owner: ${targetIp}) — possible MITM attack` });
      await sleep(rint(400, 900));
    }
  } else {
    n = countFor(i, 2, 4, 7);
    for (let k = 0; k < n; k++) {
      const ft = pick(["ICMP flood", "UDP flood", "HTTP GET flood", "SYN flood", "DNS amplification"]);
      const pps = i === "low" ? rint(5000, 20000) : i === "medium" ? rint(20000, 100000) : rint(100000, 500000);
      addAlert({ ...base, type: "dos_flood", severity: sevFor(i, { low: ["medium", "high"], medium: ["high", "critical"], high: ["critical"] }), packetCount: pps, message: `DoS ${ft}: ${pps.toLocaleString()} packets/sec from ${sourceIp} targeting ${targetIp} — service degradation detected` });
      await sleep(rint(150, 500));
    }
  }
  const run = s.simulations.find((x) => x.id === sim.id);
  if (run) { run.status = "complete"; run.completedAt = new Date().toISOString(); run.alertsGenerated = n; }
  setNode("suspicious");
  save("simulation_complete");
}

export function triggerSimulation(input: { attackType: AlertType; targetNodeId: string; intensity?: SimulationInputIntensity }): SimulationRun {
  const s = load(); const node = s.nodes.find((x) => x.id === input.targetNodeId);
  if (!node) throw new Error("Target node not found");
  const sim: SimulationRun = {
    id: uid(), attackType: input.attackType, sourceIp: pick(EXTERNAL_IPS), targetIp: node.ip, targetNodeId: node.id,
    startedAt: new Date().toISOString(), completedAt: null, status: "running", alertsGenerated: 0, intensity: input.intensity ?? "medium",
  };
  s.simulations.unshift(sim); s.simulations = s.simulations.slice(0, 100);
  save("simulation_started");
  void runSimulation(sim, node);
  return sim;
}

export function updateAlert(id: string, patch: { acknowledged?: boolean }) {
  const a = load().alerts.find((x) => x.id === id);
  if (!a) throw new Error("Alert not found");
  Object.assign(a, patch); save("alert_updated"); return a;
}
export function deleteAlert(id: string) {
  const s = load(); const before = s.alerts.length;
  s.alerts = s.alerts.filter((x) => x.id !== id);
  if (s.alerts.length === before) throw new Error("Alert not found");
  save("alert_deleted");
}
export function bulkAcknowledge() {
  let n = 0; load().alerts.forEach((a) => { if (!a.acknowledged) { a.acknowledged = true; n++; } });
  save("alerts_bulk_acknowledged"); return { acknowledged: n };
}
export function ingestSensorAlert(input: SensorAlertInput) {
  return addAlert({ ...input, targetNode: input.targetNode ?? null, packetCount: input.packetCount ?? null, portCount: input.portCount ?? null, simulationId: null }, "sensor-");
}
export function resetDemoData() {
  store = { alerts: [], nodes: SEED_NODES.map((n) => ({ ...n })), simulations: [] };
  save("reset");
}

// ---------- react-query hooks (same names as the old generated client) ----------
type QOpts<T> = { query?: Partial<UseQueryOptions<T>> };
const k = (name: string, p?: unknown) => (p ? [name, p] : [name]);
export const getListAlertsQueryKey = (p?: ListAlertsParams) => k("alerts", p);
export const getGetDashboardSummaryQueryKey = () => k("summary");
export const getGetTrafficStatsQueryKey = (p?: GetTrafficStatsParams) => k("traffic", p);
export const getGetThreatBreakdownQueryKey = () => k("threats");
export const getListNodesQueryKey = () => k("nodes");
export const getListSimulationsQueryKey = () => k("simulations");
export const getHealthCheckQueryKey = () => k("health");

function useLocal<T>(key: unknown[], fn: () => T, opts?: QOpts<T>) {
  return useQuery<T>({ ...(opts?.query ?? {}), queryKey: key, queryFn: async () => fn() } as UseQueryOptions<T>);
}
export const useListAlerts = (p?: ListAlertsParams, o?: QOpts<Alert[]>) => useLocal(getListAlertsQueryKey(p), () => listAlerts(p), o);
export const useGetDashboardSummary = (o?: QOpts<DashboardSummary>) => useLocal(getGetDashboardSummaryQueryKey(), getSummary, o);
export const useGetTrafficStats = (p?: GetTrafficStatsParams, o?: QOpts<TrafficPoint[]>) => useLocal(getGetTrafficStatsQueryKey(p), () => getTraffic(p?.minutes), o);
export const useGetThreatBreakdown = (o?: QOpts<ThreatBreakdown>) =>
  useLocal(getGetThreatBreakdownQueryKey(), () => ({ byType: countBy(load().alerts, "type"), bySeverity: countBy(load().alerts, "severity") }) as ThreatBreakdown, o);
export const useListNodes = (o?: QOpts<NetworkNode[]>) => useLocal(getListNodesQueryKey(), listNodes, o);
export const useListSimulations = (o?: QOpts<SimulationRun[]>) => useLocal(getListSimulationsQueryKey(), () => load().simulations, o);
export const useHealthCheck = (o?: QOpts<{ status: string }>) => useLocal(getHealthCheckQueryKey(), () => ({ status: "ok" }), o);

export const useUpdateAlert = () => useMutation({ mutationFn: async ({ id, data }: { id: string; data: { acknowledged?: boolean } }) => updateAlert(id, data) });
export const useDeleteAlert = () => useMutation({ mutationFn: async ({ id }: { id: string }) => deleteAlert(id) });
export const useBulkAcknowledgeAlerts = () => useMutation({ mutationFn: async (_?: void) => bulkAcknowledge() });
export const useTriggerSimulation = () => useMutation({ mutationFn: async ({ data }: { data: { attackType: AlertType; targetNodeId: string; intensity?: SimulationInputIntensity } }) => triggerSimulation(data) });
