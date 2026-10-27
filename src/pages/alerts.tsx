import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Check, Trash2, CheckSquare, AlertOctagon, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListAlerts, 
  useUpdateAlert, 
  useDeleteAlert, 
  useBulkAcknowledgeAlerts,
  getListAlertsQueryKey,
  ListAlertsType,
  ListAlertsSeverity,
  ListAlertsAcknowledged
} from "@/lib/api";
import { useEvents } from "@/hooks/use-events";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Alerts() {
  useEvents();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filterType, setFilterType] = useState<ListAlertsType | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<ListAlertsSeverity | "all">("all");
  const [filterAck, setFilterAck] = useState<ListAlertsAcknowledged | "all">("all");

  const queryParams = {
    ...(filterType !== "all" && { type: filterType }),
    ...(filterSeverity !== "all" && { severity: filterSeverity }),
    ...(filterAck !== "all" && { acknowledged: filterAck }),
  };

  const { data: alerts, isLoading } = useListAlerts(queryParams, {
    query: { refetchInterval: 5000, queryKey: getListAlertsQueryKey(queryParams) }
  });

  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();
  const bulkAck = useBulkAcknowledgeAlerts();

  const handleAck = useCallback((id: string) => {
    updateAlert.mutate(
      { id, data: { acknowledged: true } },
      {
        onSuccess: () => {
          // Optimistic update
          queryClient.setQueryData(getListAlertsQueryKey(queryParams), (old: any) => {
            if (!old) return old;
            return old.map((a: any) => a.id === id ? { ...a, acknowledged: true } : a);
          });
          toast({ title: "Alert Acknowledged", description: "The alert has been marked as reviewed." });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to acknowledge alert." });
        }
      }
    );
  }, [updateAlert, queryClient, queryParams, toast]);

  const handleDelete = useCallback((id: string) => {
    deleteAlert.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.setQueryData(getListAlertsQueryKey(queryParams), (old: any) => {
            if (!old) return old;
            return old.filter((a: any) => a.id !== id);
          });
          toast({ title: "Alert Deleted", description: "The alert has been removed from the log." });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to delete alert." });
        }
      }
    );
  }, [deleteAlert, queryClient, queryParams, toast]);

  const handleBulkAck = useCallback(() => {
    bulkAck.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        toast({ title: "Bulk Acknowledge", description: `${res.acknowledged} alerts marked as acknowledged.` });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Failed to perform bulk acknowledge." });
      }
    });
  }, [bulkAck, queryClient, toast]);

  const unackCount = alerts?.filter(a => !a.acknowledged).length || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold uppercase tracking-wider text-foreground">Alert Log</h2>
          <p className="text-muted-foreground font-mono text-sm">THREAT EVENT HISTORY</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-[140px] bg-background/50 backdrop-blur-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="port_scan">Port Scan</SelectItem>
              <SelectItem value="brute_force">Brute Force</SelectItem>
              <SelectItem value="arp_spoof">ARP Spoof</SelectItem>
              <SelectItem value="dos_flood">DoS Flood</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSeverity} onValueChange={(v: any) => setFilterSeverity(v)}>
            <SelectTrigger className="w-[140px] bg-background/50 backdrop-blur-sm">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAck} onValueChange={(v: any) => setFilterAck(v)}>
            <SelectTrigger className="w-[140px] bg-background/50 backdrop-blur-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="false">Unacknowledged</SelectItem>
              <SelectItem value="true">Acknowledged</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary/10 gap-2"
            onClick={handleBulkAck}
            disabled={unackCount === 0 || bulkAck.isPending}
            data-testid="button-bulk-ack"
          >
            <CheckSquare className="w-4 h-4" />
            Bulk Ack ({unackCount})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source IP</TableHead>
                <TableHead>Target IP</TableHead>
                <TableHead className="w-full">Message</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-8 w-16 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : !alerts || alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="w-8 h-8 opacity-20" />
                      <p>No alerts matching criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map(alert => (
                  <TableRow 
                    key={alert.id} 
                    className={!alert.acknowledged ? "bg-primary/5" : ""}
                    data-testid={`row-alert-${alert.id}`}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(alert.detectedAt), "HH:mm:ss.SSS")}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={alert.severity} />
                    </TableCell>
                    <TableCell className="font-display uppercase text-xs tracking-wider">
                      {alert.type.replace('_', ' ')}
                    </TableCell>
                    <TableCell>{alert.sourceIp}</TableCell>
                    <TableCell>{alert.targetIp}</TableCell>
                    <TableCell className="truncate max-w-md" title={alert.message}>
                      {alert.message}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {!alert.acknowledged && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => handleAck(alert.id)}
                            disabled={updateAlert.isPending}
                            data-testid={`btn-ack-${alert.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" /> Ack
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(alert.id)}
                          disabled={deleteAlert.isPending}
                          data-testid={`btn-del-${alert.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return (
        <Badge variant="destructive" className="animate-pulse bg-destructive text-destructive-foreground">
          <AlertOctagon className="w-3 h-3 mr-1" /> CRITICAL
        </Badge>
      );
    case 'high':
      return <Badge variant="destructive">HIGH</Badge>;
    case 'medium':
      return <Badge variant="warning">MEDIUM</Badge>;
    case 'low':
      return <Badge variant="success">LOW</Badge>;
    default:
      return <Badge variant="outline">{severity.toUpperCase()}</Badge>;
  }
}
