import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Radar,
  Hash,
  Layers,
  Radio,
  Activity,
  Shield,
  Cpu,
  Brain,
  Crosshair,
  TrendingUp,
  LineChart,
  Bot,
  Library,
  History,
  Settings,
  BarChart3,
  BookOpen,
  Newspaper,
  Home,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  soon?: boolean;
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Intelligence",
    items: [
      { title: "Apex Sentinel", url: "/app/apex", icon: Crosshair },
      { title: "Precision Edge V2", url: "/app/precision-edge", icon: Cpu },
      { title: "Precision Parity AI", url: "/app/precision-parity", icon: Brain },
      { title: "Precision Trend AI", url: "/app/precision-trend", icon: TrendingUp },
    ],
  },
  {
    label: "Analysis",
    items: [
      { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
      { title: "AI Scanner", url: "/app/scanner", icon: Radar },
      { title: "Digits", url: "/app/scanner/digits", icon: Hash },
      { title: "Volatility", url: "/app/scanner/volatility", icon: Layers },
      { title: "Signals", url: "/app/signals", icon: Radio },
    ],
  },
  {
    label: "Trading",
    items: [
      { title: "Manual Trading", url: "/app/trading", icon: LineChart },
      { title: "Auto Trading", url: "/app/auto-trading", icon: Bot },
      { title: "Bot Builder", url: "/app/bot-builder", icon: Cpu },
      { title: "Bot Library", url: "/app/bot-library", icon: Library },
      { title: "Trade History", url: "/app/history", icon: History },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", url: "/app/analytics", icon: BarChart3, soon: true },
      { title: "Trading Journal", url: "/app/journal", icon: BookOpen, soon: true },
      { title: "Market News", url: "/app/news", icon: Newspaper, soon: true },
    ],
  },
];

const accountItems: NavItem[] = [{ title: "Settings", url: "/app/settings", icon: Settings }];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const allUrls = [
    ...groups.flatMap((g) => g.items.map((i) => i.url)),
    ...accountItems.map((i) => i.url),
    "/app/admin",
  ];

  // Exact match wins. A prefix match only highlights when no more specific
  // nav item covers the current path (so /app/scanner/digits doesn't light
  // up "AI Scanner" as well).
  const isActive = (url: string) => {
    if (pathname === url) return true;
    if (!pathname.startsWith(url + "/")) return false;
    return !allUrls.some(
      (other) =>
        other !== url &&
        other.length > url.length &&
        (pathname === other || pathname.startsWith(other + "/")),
    );
  };

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
  });

  const account: NavItem[] = isAdmin
    ? [...accountItems, { title: "Admin", url: "/app/admin", icon: Shield }]
    : accountItems;

  const allGroups = [...groups, { label: "Account", items: account }];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/40">
        <a href="/?home=1" className="flex items-center gap-2 px-2 py-3" title="Home">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[var(--neon)] to-[var(--accent)] flex items-center justify-center shrink-0">
            <Activity size={16} className="text-[var(--primary-foreground)]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-wide neon-text">
                PRECISION <span className="text-[var(--accent)]">EDGE</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                AI Trading Platform
              </span>
            </div>
          )}
        </a>
      </SidebarHeader>
      <SidebarContent>
        {allGroups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.soon ? `${item.title} — coming soon` : item.title}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon size={16} className={item.soon ? "opacity-60" : undefined} />
                        {!collapsed && (
                          <>
                            <span className={item.soon ? "text-muted-foreground" : undefined}>
                              {item.title}
                            </span>
                            {item.soon && (
                              <span className="ml-auto text-[9px] uppercase tracking-widest text-muted-foreground border border-border/60 rounded px-1 py-0.5">
                                Soon
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-border/40">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Home">
              <a href="/?home=1" className="flex items-center gap-2">
                <Home size={16} />
                {!collapsed && <span>Home</span>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
