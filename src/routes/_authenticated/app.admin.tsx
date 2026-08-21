import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({ meta: [{ title: "Admin — Precision Edge" }] }),
  component: () => (
    <PlaceholderPage
      title="Admin"
      description="Manage users, signals, and platform-wide announcements."
      phase="Later"
    />
  ),
});
