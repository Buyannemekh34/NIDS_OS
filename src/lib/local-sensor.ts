import { ingestSensorAlert } from "@/lib/api";
export type LocalSensorStatus = {
  sensorVersion: string;
  platform: string;
  captureActive: boolean;
  interface: string | null;
  bpf: string;
  startedAt: string | null;
  lastPacketAt: string | null;
  packetsSeen: number;
  bytesSeen: number;
  eventsDetected: number;
  packetsPerSecond: number;
  error: string | null;
  npcapRequired: boolean;
  rules: string[];
};

export type LocalSensorInterface = {
  name: string;
  description: string;
  address: string;
  mac: string;
};

export type LocalSensorEvent = {
  id: string;
  timestamp: string;
  category: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | string;
  source: string;
  sourceIp: string;
  targetIp: string;
  targetPort?: number | null;
  interface?: string | null;
  evidence: string;
  mitreTechnique: string;
  action: string;
};

export const LOCAL_SENSOR_URL =
  import.meta.env["VITE_SENSOR_URL"] || "http://127.0.0.1:8765";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${LOCAL_SENSOR_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    let message = `Sensor returned HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the status-based error when the sensor did not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getLocalSensorHealth(): Promise<{
  status: string;
  sensor: LocalSensorStatus;
}> {
  return request("/health");
}

export async function getLocalSensorInterfaces(): Promise<{
  interfaces: LocalSensorInterface[];
}> {
  return request("/interfaces");
}

export async function getLocalSensorEvents(limit = 50): Promise<{
  events: LocalSensorEvent[];
}> {
  return request(`/events?limit=${limit}`);
}

export async function startLocalSensor(interfaceName: string, bpf: string) {
  return request<{ sensor: LocalSensorStatus }>("/capture/start", {
    method: "POST",
    body: JSON.stringify({ interface: interfaceName, bpf }),
  });
}

export async function stopLocalSensor() {
  return request<{ sensor: LocalSensorStatus }>("/capture/stop", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function ingestSensorEvent(event: LocalSensorEvent) {
  const types = ["port_scan", "brute_force", "arp_spoof", "dos_flood"] as const;
  const sevs = ["low", "medium", "high", "critical"] as const;
  const type = (types as readonly string[]).includes(event.category) ? (event.category as (typeof types)[number]) : "port_scan";
  const severity = (sevs as readonly string[]).includes(event.severity) ? (event.severity as (typeof sevs)[number]) : "medium";
  return ingestSensorAlert({ type, severity, sourceIp: event.sourceIp, targetIp: event.targetIp, message: `${event.title}: ${event.evidence}` });
}
