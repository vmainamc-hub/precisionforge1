import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/app/news")({
  head: () => ({ meta: [{ title: "Market News — Precision Edge" }] }),
  component: () => (
    <PlaceholderPage
      title="Market News"
      description="Curated Deriv and macro market news feed."
      phase="Later"
    />
  ),
});
