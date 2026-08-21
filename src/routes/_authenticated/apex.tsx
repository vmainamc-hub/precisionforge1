import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/apex")({
  beforeLoad: () => {
    throw redirect({ to: "/app/apex" });
  },
});
