import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/precision-trend")({
  beforeLoad: () => {
    throw redirect({ to: "/app/precision-trend" });
  },
});
