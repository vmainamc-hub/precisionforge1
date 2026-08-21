import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/precision-parity")({
  beforeLoad: () => {
    throw redirect({ to: "/app/precision-parity" });
  },
});
