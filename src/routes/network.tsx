import { createFileRoute } from "@tanstack/react-router";
import Network from "@/pages/network";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Network Topology — NIDS.OS" },
      { name: "description", content: "Monitored nodes and their live security status." },
      { property: "og:title", content: "Network Topology — NIDS.OS" },
      { property: "og:description", content: "Monitored nodes and their live security status." },
    ],
  }),
  component: Network,
});
