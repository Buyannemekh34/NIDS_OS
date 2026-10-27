import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Zap, Crosshair, Skull, History, AlertTriangle, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListNodes, 
  useTriggerSimulation, 
  useListSimulations,
  SimulationInputAttackType,
  SimulationInputIntensity,
  getListNodesQueryKey,
  getListSimulationsQueryKey
} from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Simulate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: nodes, isLoading: loadingNodes } = useListNodes({
    query: { queryKey: getListNodesQueryKey() }
  });
  const { data: simulations, isLoading: loadingSimulations } = useListSimulations({
    query: { refetchInterval: 5000, queryKey: getListSimulationsQueryKey() }
  });

  const triggerSim = useTriggerSimulation();

  const [targetNodeId, setTargetNodeId] = useState<string>("");
  const [attackType, setAttackType] = useState<SimulationInputAttackType | "">("");
  const [intensity, setIntensity] = useState<SimulationInputIntensity | "">("");

  const handleFire = useCallback(() => {
    if (!targetNodeId || !attackType || !intensity) {
      toast({ variant: "destructive", title: "Missing Parameters", description: "Select target, attack type, and intensity." });
      return;
    }

    triggerSim.mutate(
      { data: { targetNodeId, attackType: attackType as SimulationInputAttackType, intensity: intensity as SimulationInputIntensity } },
      {
        onSuccess: (res) => {
          toast({ 
            title: "Simulation Triggered", 
            description: `Attack ${res.id} initiated against ${res.targetIp}` 
          });
          queryClient.invalidateQueries({ queryKey: getListSimulationsQueryKey() });
          setTargetNodeId("");
          setAttackType("");
          setIntensity("");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to start simulation." });
        }
      }
    );
  }, [targetNodeId, attackType, intensity, triggerSim, toast, queryClient]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div>
        <h2 className="text-2xl font-display font-bold uppercase tracking-wider text-destructive glow-text-destructive">Attack Simulator</h2>
        <p className="text-muted-foreground font-mono text-sm">LIVE THREAT INJECTION TERMINAL</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card glow="destructive" className="border-destructive/30">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Skull className="w-5 h-5" /> Target Parameter Configuration
            </CardTitle>
            <CardDescription>Select vector and target node to initiate simulated intrusion.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase">Target Node</label>
              <Select value={targetNodeId} onValueChange={setTargetNodeId} disabled={loadingNodes}>
                <SelectTrigger className="w-full bg-background border-destructive/20 focus:ring-destructive">
                  <SelectValue placeholder="Select target..." />
                </SelectTrigger>
                <SelectContent>
                  {nodes?.map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name} ({node.ip}) - {node.role.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase">Attack Vector</label>
              <Select value={attackType} onValueChange={(v: any) => setAttackType(v)}>
                <SelectTrigger className="w-full bg-background border-destructive/20 focus:ring-destructive">
                  <SelectValue placeholder="Select vector..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="port_scan">Port Scan (Reconnaissance)</SelectItem>
                  <SelectItem value="brute_force">Brute Force (Credential Access)</SelectItem>
                  <SelectItem value="arp_spoof">ARP Spoof (Man-in-the-Middle)</SelectItem>
                  <SelectItem value="dos_flood">DoS Flood (Availability)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase">Intensity</label>
              <Select value={intensity} onValueChange={(v: any) => setIntensity(v)}>
                <SelectTrigger className="w-full bg-background border-destructive/20 focus:ring-destructive">
                  <SelectValue placeholder="Select intensity..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Stealth)</SelectItem>
                  <SelectItem value="medium">Medium (Standard)</SelectItem>
                  <SelectItem value="high">High (Aggressive)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t border-destructive/20">
              <Button 
                variant="destructive" 
                size="lg" 
                className="w-full h-14 text-lg animate-pulse hover:animate-none font-bold"
                onClick={handleFire}
                disabled={triggerSim.isPending || !targetNodeId || !attackType || !intensity}
                data-testid="button-fire-attack"
              >
                {triggerSim.isPending ? "INITIALIZING..." : (
                  <>
                    <Zap className="w-6 h-6 mr-2" /> FIRE SIMULATION
                  </>
                )}
              </Button>
            </div>
            
          </CardContent>
        </Card>

        {/* Warning Panel */}
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" /> Warning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">
              Executing a simulation will inject synthetic malicious traffic into the monitored network. 
              This will trigger real alerts, update dashboard metrics, and change node statuses to <span className="text-destructive glow-text-destructive font-bold">UNDER ATTACK</span>.
            </p>
            <div className="p-4 border border-destructive/20 bg-background/50 rounded-md space-y-2">
              <div className="flex items-start gap-3 text-xs font-mono text-muted-foreground">
                <Crosshair className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>Port Scans generate high volume of low-severity alerts</span>
              </div>
              <div className="flex items-start gap-3 text-xs font-mono text-muted-foreground">
                <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>Brute Force targets SSH/FTP ports with critical severity</span>
              </div>
              <div className="flex items-start gap-3 text-xs font-mono text-muted-foreground">
                <Zap className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>DoS Floods spike traffic charts and generate rapid critical alerts</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulation Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Recent Simulations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Attack Vector</TableHead>
                <TableHead>Target IP</TableHead>
                <TableHead>Intensity</TableHead>
                <TableHead>Alerts Generated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSimulations ? (
                 Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 w-20 bg-muted animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              ) : !simulations || simulations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <p className="font-mono text-sm">No simulations executed yet</p>
                  </TableCell>
                </TableRow>
              ) : (
                simulations.map(sim => (
                  <TableRow key={sim.id} data-testid={`row-sim-${sim.id}`}>
                    <TableCell className="text-muted-foreground font-mono whitespace-nowrap">
                      {format(new Date(sim.startedAt), "HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-display uppercase tracking-wider text-xs">
                      {sim.attackType.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="font-mono">{sim.targetIp}</TableCell>
                    <TableCell>
                      <IntensityBadge intensity={sim.intensity} />
                    </TableCell>
                    <TableCell className="font-mono font-bold text-primary">
                      {sim.alertsGenerated}
                    </TableCell>
                    <TableCell>
                      <SimStatusBadge status={sim.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}

function IntensityBadge({ intensity }: { intensity: string }) {
  switch (intensity) {
    case 'high': return <Badge variant="destructive">HIGH</Badge>;
    case 'medium': return <Badge variant="warning">MEDIUM</Badge>;
    case 'low': return <Badge variant="success">LOW</Badge>;
    default: return <Badge variant="outline">{intensity.toUpperCase()}</Badge>;
  }
}

function SimStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running': 
      return <Badge variant="warning" className="animate-pulse">RUNNING</Badge>;
    case 'complete': 
      return <Badge variant="success">COMPLETE</Badge>;
    case 'failed': 
      return <Badge variant="destructive">FAILED</Badge>;
    default: 
      return <Badge variant="outline">{status.toUpperCase()}</Badge>;
  }
}
