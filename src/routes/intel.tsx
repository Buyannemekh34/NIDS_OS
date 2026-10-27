import { createFileRoute } from "@tanstack/react-router";
import Intel from "@/pages/intel";

export const Route = createFileRoute("/intel")({
  head: () => ({
    meta: [
      { title: "Threat Intel — NIDS.OS" },
      { name: "description", content: "Attacker sources, signatures and threat intelligence." },
      { property: "og:title", content: "Threat Intel — NIDS.OS" },
      { property: "og:description", content: "Attacker sources, signatures and threat intelligence." },
    ],
  }),
  component: Intel,
});
