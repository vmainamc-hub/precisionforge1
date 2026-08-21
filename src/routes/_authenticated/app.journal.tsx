import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/app/journal")({
  head: () => ({ meta: [{ title: "Trading Journal — Precision Edge" }] }),
  component: () => (
    <PlaceholderPage
      title="Trading Journal"
      description="Log your trade thoughts, tag setups, and review outcomes."
      phase="Later"
    />
  ),
});
