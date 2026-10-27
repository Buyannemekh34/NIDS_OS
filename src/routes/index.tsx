import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/pages/dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Center — NIDS.OS" },
      { name: "description", content: "Live SOC overview: incidents, traffic and threat severity." },
      { property: "og:title", content: "Command Center — NIDS.OS" },
      { property: "og:description", content: "Live SOC overview: incidents, traffic and threat severity." },
    ],
  }),
  component: Dashboard,
});
