import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, AlertTriangle, Command, Crosshair, Network, Radio, Search, Shield, Terminal, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHealthCheckQueryKey, useHealthCheck } from "@/lib/api";
import { useLocalSensor } from "@/hooks/use-local-sensor";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const setLocation = (to: string) => void navigate({ to });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [lastEvent, setLastEvent] = useState<Date | null>(null);
  const { data: health } = useHealthCheck({ query: { refetchInterval: 30000, queryKey: getHealthCheckQueryKey() } });
  useLocalSensor({ ingestEvents: true });

  const navItems = [
    { href: "/", label: "Command Center", icon: Activity },
    { href: "/alerts", label: "Alert Log", icon: AlertTriangle },
    { href: "/intel", label: "Threat Intel", icon: Crosshair },
    { href: "/network", label: "Network Topology", icon: Network },
    { href: "/simulate", label: "Attack Simulator", icon: Zap },
    { href: "/sensor", label: "Sensor Control", icon: Radio },
  ];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setLastEvent(new Date());
    const interval = window.setInterval(() => setLastEvent(new Date()), 5000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 border-r border-border bg-sidebar flex-shrink-0 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30 scanline" />
        <div className="p-5 md:p-6 border-b border-border flex items-center gap-3 relative">
          <div className="relative">
            <Shield className="w-8 h-8 text-primary glow-text-primary" />
            <span className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full bg-success ring-2 ring-sidebar" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-widest text-primary uppercase">NIDS.OS</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em]">University SOC / Lab 04</p>
          </div>
        </div>

        <nav className="flex-1 p-3 md:p-4 space-y-1.5 relative">
          <p className="px-3 pb-2 pt-1 text-[9px] font-mono uppercase tracking-[0.24em] text-muted-foreground/70">Operations</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} to={item.href} data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`} className="block">
                <div className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-md transition-all duration-200 font-display uppercase tracking-wide cursor-pointer group",
                  isActive ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_18px_hsl(var(--primary)/0.08)]" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                )}>
                  <Icon className={cn("w-4 h-4 transition-transform duration-200", !isActive && "group-hover:translate-x-0.5")} />
                  <span className="text-xs font-medium">{item.label}</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border bg-sidebar/50 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">SYSTEM STATUS</span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", health?.status === "ok" ? "bg-primary" : "bg-destructive")} />
                <span className={cn("relative inline-flex rounded-full h-2 w-2", health?.status === "ok" ? "bg-primary" : "bg-destructive")} />
              </span>
              <span className="text-xs font-mono font-bold uppercase" style={{ color: health?.status === "ok" ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}>
                {health?.status === "ok" ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <Terminal className="h-3 w-3 text-primary/70" />
            <span>TELEMETRY BUS / SSE</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col min-h-0 bg-grid relative z-0">
        <div className="pointer-events-none absolute inset-0 z-[-1] bg-gradient-to-b from-background via-background/95 to-background" />
        <header className="h-12 shrink-0 border-b border-border/80 bg-background/80 backdrop-blur-md px-4 md:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-success whitespace-nowrap">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>
              Live telemetry
            </div>
            <span className="hidden sm:block text-border">/</span>
            <span className="hidden sm:block text-[10px] font-mono text-muted-foreground truncate" data-testid="text-last-event">
              LAST EVENT {lastEvent ? lastEvent.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "--:--:--"}
            </span>
          </div>
          <button type="button" onClick={() => setPaletteOpen(true)} data-testid="button-command-palette" className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
            <Search className="h-3 w-3" />
            <span className="hidden sm:inline">QUICK NAV</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[9px] text-foreground">⌘K</kbd>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </div>
      </main>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setPaletteOpen(false)} data-testid="command-palette-overlay">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-primary/30 bg-popover shadow-2xl shadow-primary/10 animate-soft-rise" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-label="Quick navigation" data-testid="command-palette">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Command className="h-4 w-4 text-primary" />
              <span className="flex-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">Jump to operation</span>
              <button type="button" onClick={() => setPaletteOpen(false)} className="text-muted-foreground hover:text-foreground" data-testid="button-close-command-palette"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.href} type="button" onClick={() => { setLocation(item.href); setPaletteOpen(false); }} data-testid={`command-${item.label.toLowerCase().replace(/\s+/g, "-")}`} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary", location === item.href ? "bg-primary/10 text-primary" : "text-foreground")}>
                    <Icon className="h-4 w-4" /><span className="font-display uppercase tracking-wide">{item.label}</span><span className="ml-auto font-mono text-[10px] text-muted-foreground">{item.href}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border px-4 py-2 text-[10px] font-mono text-muted-foreground">ESC TO CLOSE · ENTER TO SELECT</div>
          </div>
        </div>
      )}
    </div>
  );
}