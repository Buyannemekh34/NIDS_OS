import { useCallback, useEffect, useState } from "react";
import {
  getLocalSensorEvents,
  getLocalSensorHealth,
  getLocalSensorInterfaces,
  ingestSensorEvent,
  LOCAL_SENSOR_URL,
  LocalSensorEvent,
  LocalSensorInterface,
  LocalSensorStatus,
  startLocalSensor,
  stopLocalSensor,
} from "@/lib/local-sensor";

export function useLocalSensor(options: { ingestEvents?: boolean } = {}) {
  const ingestEvents = options.ingestEvents ?? false;
  const [status, setStatus] = useState<LocalSensorStatus | null>(null);
  const [interfaces, setInterfaces] = useState<LocalSensorInterface[]>([]);
  const [events, setEvents] = useState<LocalSensorEvent[]>([]);
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [health, adapterList, eventList] = await Promise.all([
        getLocalSensorHealth(),
        getLocalSensorInterfaces(),
        getLocalSensorEvents(),
      ]);
      setStatus(health.sensor);
      setInterfaces(adapterList.interfaces);
      setEvents(eventList.events);
      setConnection("online");
      setError(null);
    } catch (cause) {
      setConnection("offline");
      setError(cause instanceof Error ? cause.message : "Local sensor is unavailable.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (connection !== "online") return;
    const stream = new EventSource(`${LOCAL_SENSOR_URL}/events/stream`);
    stream.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as {
          type: string;
          data: LocalSensorEvent | LocalSensorStatus;
        };
        if (payload.type === "sensor_event") {
          const event = payload.data as LocalSensorEvent;
          setEvents((current) => [event, ...current].slice(0, 50));
          if (ingestEvents) {
            void ingestSensorEvent(event).catch(() => {
              // The local sensor remains useful if the optional dashboard API is unavailable.
            });
          }
        }
        if (payload.type === "sensor_status") {
          setStatus(payload.data as LocalSensorStatus);
        }
      } catch {
        // Ignore malformed stream messages and let the next poll recover state.
      }
    };
    stream.onerror = () => {
      stream.close();
      setConnection("offline");
    };
    return () => stream.close();
  }, [connection, ingestEvents]);

  const start = useCallback(async (interfaceName: string, bpf: string) => {
    const response = await startLocalSensor(interfaceName, bpf);
    setStatus(response.sensor);
    setConnection("online");
    setError(null);
    return response.sensor;
  }, []);

  const stop = useCallback(async () => {
    const response = await stopLocalSensor();
    setStatus(response.sensor);
    setConnection("online");
    return response.sensor;
  }, []);

  return { status, interfaces, events, connection, error, refresh, start, stop };
}