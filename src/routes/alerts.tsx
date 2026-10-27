import { createFileRoute } from "@tanstack/react-router";
import Alerts from "@/pages/alerts";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alert Log — NIDS.OS" },
      { name: "description", content: "Review, acknowledge and triage intrusion alerts." },
      { property: "og:title", content: "Alert Log — NIDS.OS" },
      { property: "og:description", content: "Review, acknowledge and triage intrusion alerts." },
    ],
  }),
  component: Alerts,
});
