import { createFileRoute } from "@tanstack/react-router";
import Sensor from "@/pages/sensor";

export const Route = createFileRoute("/sensor")({
  head: () => ({
    meta: [
      { title: "Sensor Control — NIDS.OS" },
      { name: "description", content: "Control the local packet-capture sensor." },
      { property: "og:title", content: "Sensor Control — NIDS.OS" },
      { property: "og:description", content: "Control the local packet-capture sensor." },
    ],
  }),
  component: Sensor,
});
