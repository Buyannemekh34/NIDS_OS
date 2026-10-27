import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Square,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocalSensor } from "@/hooks/use-local-sensor";

const numberFormatter = new Intl.NumberFormat();

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour12: false });
}

export default function Sensor() {
  const { toast } = useToast();
  const { status, interfaces, events, connection, error, refresh, start, stop } = useLocalSensor();
  const [selectedInterface, setSelectedInterface] = useState("");
  const [bpf, setBpf] = useState("ip or arp");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedInterface && interfaces.length > 0) {
      setSelectedInterface(interfaces[0]!.name);
    }
  }, [interfaces, selectedInterface]);

  useEffect(() => {
    if (status?.interface) setSelectedInterface(status.interface);
    if (status?.bpf) setBpf(status.bpf);
  }, [status?.interface, status?.bpf]);

  const isOnline = connection === "online";
  const isCapturing = status?.captureActive === true;
  const localAddress = useMemo(() => status?.interface || "No interface selected", [status?.interface]);

  async function handleStart() {
    if (!selectedInterface) {
      toast({ variant: "destructive", title: "Interface required", description: "Choose a network adapter first." });
      return;
    }
    setBusy(true);
    try {
      await start(selectedInterface, bpf);
      toast({ title: "Capture started", description: `Passive monitoring is active on ${selectedInterface}.` });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Capture could not start",
        description: cause instanceof Error ? cause.message : "Check Npcap and Administrator privileges.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await stop();
      toast({ title: "Capture stopped", description: "The local sensor is no longer reading packets." });
    } catch (cause) {
      toast({ variant: "destructive", title: "Stop failed", description: cause instanceof Error ? cause.message : "The sensor did not respond." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-primary">
            <Radio className="h-3.5 w-3.5" /> Local capture plane
          </div>
          <h2 className="mt-2 text-2xl font-display font-bold uppercase tracking-wider text-primary glow-text-primary">Sensor Control</h2>
          <p className="text-muted-foreground font-mono text-sm">WINDOWS / NPCAP / PASSIVE OBSERVATION</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-success shadow-[0_0_8px_hsl(var(--success))]" : "bg-destructive"}`} />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {isOnline ? "LOCAL SENSOR REACHABLE" : "LOCAL SENSOR OFFLINE"}
          </span>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={connection === "connecting"}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {!isOnline && (
        <Card glow="warning" className="border-warning/30">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-display uppercase tracking-wide text-warning">NIDS-Sensor.exe is not reachable</p>
              <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                Build the Windows sensor from <span className="text-foreground">sensor/build.ps1</span>, install Npcap in WinPcap-compatible mode, then run the executable as Administrator. {error || "The dashboard will keep operating with its server-side demo telemetry until the local sensor connects."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Capture", isCapturing ? "ACTIVE" : "STOPPED", isCapturing ? "text-success" : "text-muted-foreground"],
          ["Interface", localAddress, "text-primary"],
          ["Packets", numberFormatter.format(status?.packetsSeen ?? 0), "text-foreground"],
          ["Detections", numberFormatter.format(status?.eventsDetected ?? 0), "text-warning"],
        ].map(([label, value, color]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className={`mt-2 truncate font-display text-xl font-bold uppercase ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card glow={isCapturing ? "primary" : undefined}>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5 text-primary" /> Capture configuration</CardTitle>
            <CardDescription>Select the adapter connected to the network you are authorised to monitor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <label htmlFor="sensor-interface" className="font-mono text-xs uppercase text-muted-foreground">Network interface</label>
              <select id="sensor-interface" value={selectedInterface} onChange={(event) => setSelectedInterface(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground outline-none focus:border-primary">
                <option value="">Choose an adapter…</option>
                {interfaces.map((adapter) => (
                  <option key={adapter.name} value={adapter.name}>{adapter.address || "no IPv4"} · {adapter.name}</option>
                ))}
              </select>
              <p className="font-mono text-[10px] text-muted-foreground">{interfaces.length} adapter(s) discovered by Scapy/Npcap.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="sensor-bpf" className="font-mono text-xs uppercase text-muted-foreground">Capture filter (BPF)</label>
              <input id="sensor-bpf" value={bpf} onChange={(event) => setBpf(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground outline-none focus:border-primary" placeholder="ip or arp" />
              <p className="font-mono text-[10px] text-muted-foreground">Default captures IPv4 and ARP without retaining payloads.</p>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-border/50 pt-5">
              <Button onClick={() => void handleStart()} disabled={busy || !isOnline || isCapturing}>
                <Play className="mr-2 h-4 w-4" /> {busy ? "Starting…" : "Start capture"}
              </Button>
              <Button variant="outline" onClick={() => void handleStop()} disabled={busy || !isCapturing}>
                <Square className="mr-2 h-4 w-4" /> Stop capture
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">The sensor binds to 127.0.0.1 only, never sends packets, and stores metadata rather than packet contents. Only monitor networks you own or are authorised to assess.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Sensor telemetry</CardTitle>
            <CardDescription>Runtime state reported by the executable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 font-mono text-xs">
            {[
              ["Packets / second", `${status?.packetsPerSecond ?? 0}`],
              ["Bytes observed", numberFormatter.format(status?.bytesSeen ?? 0)],
              ["Last packet", formatTime(status?.lastPacketAt)],
              ["Capture started", formatTime(status?.startedAt)],
              ["Npcap", status ? (status.npcapRequired ? "REQUIRED / DETECTED AT START" : "NOT REQUIRED") : "UNKNOWN / SENSOR OFFLINE"],
              ["Rules", `${status?.rules.length ?? 0} explainable detectors`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-border/40 pb-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right text-foreground">{value}</span>
              </div>
            ))}
            {status?.error && <p className="rounded border border-destructive/30 bg-destructive/5 p-3 text-destructive">{status.error}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Live sensor detections</CardTitle>
          <CardDescription>Events produced by the local packet-capture rules, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="p-8 text-center font-mono text-sm text-muted-foreground">No local detections yet. Start capture and generate normal authorised lab traffic to validate the pipeline.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {events.map((event) => (
                <div key={event.id} className="grid gap-2 px-5 py-4 md:grid-cols-[110px_120px_1fr_auto] md:items-center">
                  <span className="font-mono text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                  <Badge variant={event.severity === "critical" ? "destructive" : event.severity === "high" ? "warning" : "outline"}>{event.severity}</Badge>
                  <div className="min-w-0">
                    <p className="truncate font-display uppercase tracking-wide text-foreground">{event.title}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{event.sourceIp} → {event.targetIp} · {event.evidence}</p>
                  </div>
                  <span className="font-mono text-[10px] text-primary">{event.mitreTechnique}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}