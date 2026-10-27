import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribe } from "@/lib/api";

/** Live telemetry bus: refreshes every query whenever the local event store changes. */
export function useEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unsub = subscribe(() => {
      void queryClient.invalidateQueries();
    });
    return () => {
      unsub();
    };
  }, [queryClient]);
}
