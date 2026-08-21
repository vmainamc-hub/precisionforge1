import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Precision Edge" }] }),
  component: () => (
    <PlaceholderPage
      title="Analytics"
      description="Win rate, profit factor, expectancy, drawdown and equity curve computed from your trade history."
      phase="Phase 3"
    />
  ),
});
