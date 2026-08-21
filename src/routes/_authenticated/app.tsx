import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopBar } from "@/components/app/AppTopBar";
import { StreamProvider } from "@/lib/stream-context";
import { DerivAccountProvider } from "@/lib/deriv/account-context";
import { AutoTraderProvider } from "@/lib/deriv/auto-trader";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <DerivAccountProvider>
      <StreamProvider>
        <AutoTraderProvider>
          <SidebarProvider>
            <div className="min-h-screen flex w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <AppTopBar />
                <main className="flex-1 grid-bg">
                  <Outlet />
                </main>
              </div>
            </div>
          </SidebarProvider>
        </AutoTraderProvider>
      </StreamProvider>
    </DerivAccountProvider>
  );
}
