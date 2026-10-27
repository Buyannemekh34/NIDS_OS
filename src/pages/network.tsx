import { getListNodesQueryKey, useListNodes } from "@/lib/api";
import { Server, Monitor, Router, Shield, AlertTriangle, AlertCircle, Activity, Globe } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Network() {
  const { data: nodes, isLoading } = useListNodes({
    query: { refetchInterval: 5000, queryKey: getListNodesQueryKey() }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div>
        <h2 className="text-2xl font-display font-bold uppercase tracking-wider text-foreground">Network Topology</h2>
        <p className="text-muted-foreground font-mono text-sm">MONITORED INFRASTRUCTURE</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="opacity-50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded bg-muted animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-10 w-full bg-muted animate-pulse rounded mt-4" />
              </CardContent>
            </Card>
          ))
        ) : !nodes || nodes.length === 0 ? (
          <div className="col-span-full h-48 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
            <Globe className="w-8 h-8 opacity-20 mb-2" />
            <p className="font-mono text-sm">No network nodes detected</p>
          </div>
        ) : (
          nodes.map(node => {
            let glow: "primary" | "warning" | "destructive" | undefined;
            if (node.status === "under_attack") glow = "destructive";
            else if (node.status === "suspicious") glow = "warning";
            else if (node.status === "online") glow = "primary";

            return (
              <Card 
                key={node.id} 
                glow={glow} 
                className="group hover:-translate-y-1 transition-transform duration-300"
                data-testid={`node-card-${node.id}`}
              >
                <CardHeader className="pb-4 border-b border-border/50">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className={`p-2 rounded bg-background border border-border ${glow ? `bg-${glow}/10 border-${glow}/30` : ''}`}>
                        <RoleIcon role={node.role} className={`w-6 h-6 ${glow ? `text-${glow}` : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <h3 className="font-display font-bold uppercase tracking-wide text-foreground">{node.name}</h3>
                        <p className="font-mono text-xs text-muted-foreground">{node.ip}</p>
                      </div>
                    </div>
                    <StatusBadge status={node.status} />
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between items-center text-sm font-mono">
                    <span className="text-muted-foreground">OS</span>
                    <span className="uppercase text-xs font-semibold">{node.os}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm font-mono">
                    <span className="text-muted-foreground">Role</span>
                    <span className="uppercase text-xs bg-muted px-2 py-0.5 rounded text-foreground">{node.role}</span>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">Recent Alerts</span>
                      <span className={`font-mono font-bold ${node.alertCount && node.alertCount > 0 ? 'text-destructive glow-text-destructive' : 'text-muted-foreground'}`}>
                        {node.alertCount || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function RoleIcon({ role, className }: { role: string, className?: string }) {
  switch (role) {
    case 'server': return <Server className={className} />;
    case 'client': return <Monitor className={className} />;
    case 'router': return <Router className={className} />;
    case 'gateway': return <Shield className={className} />;
    default: return <Server className={className} />;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'online':
      return (
        <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 gap-1">
          <Activity className="w-3 h-3" /> ONLINE
        </Badge>
      );
    case 'suspicious':
      return (
        <Badge variant="warning" className="gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3" /> SUSPICIOUS
        </Badge>
      );
    case 'under_attack':
      return (
        <Badge variant="destructive" className="gap-1 animate-pulse bg-destructive text-destructive-foreground">
          <AlertCircle className="w-3 h-3" /> UNDER ATTACK
        </Badge>
      );
    case 'offline':
      return (
        <Badge variant="secondary" className="gap-1">
          <Globe className="w-3 h-3" /> OFFLINE
        </Badge>
      );
    default:
      return <Badge variant="outline">{status.toUpperCase()}</Badge>;
  }
}
