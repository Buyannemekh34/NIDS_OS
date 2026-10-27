import { createFileRoute } from "@tanstack/react-router";
import Simulate from "@/pages/simulate";

export const Route = createFileRoute("/simulate")({
  head: () => ({
    meta: [
      { title: "Attack Simulator — NIDS.OS" },
      { name: "description", content: "Launch safe synthetic attacks to test detection." },
      { property: "og:title", content: "Attack Simulator — NIDS.OS" },
      { property: "og:description", content: "Launch safe synthetic attacks to test detection." },
    ],
  }),
  component: Simulate,
});
