"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircleMore, MessageCircle, ShieldCheck, SquarePlus, UserRound } from "lucide-react";

const tabs = [
  { id: "home", label: "Home", icon: Home, href: "/troop" },
  { id: "thoughts", label: "Thoughts", icon: MessageCircleMore, href: "/thoughts" },
  { id: "posts", label: "Posts", icon: SquarePlus, href: "/posts" },
  { id: "messages", label: "Messages", icon: MessageCircle, href: "/messages" },
  { id: "profile", label: "Profile", icon: UserRound, href: "/profile" },
] as const;

const adminTab = { id: "admin", label: "Admin", icon: ShieldCheck, href: "/admin" } as const;

export function BetaBottomNav({
  unreadMessageCount = 0,
  isAdmin = false,
}: {
  unreadMessageCount?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const visibleTabs = isAdmin ? [...tabs, adminTab] : tabs;
  const isTabActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const activeTab = visibleTabs.find((tab) => isTabActive(tab.href)) ?? tabs[0];

  return (
    <nav
      aria-label="Beta app navigation"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-2 sm:px-4"
    >
      <div
        className={`w-full rounded-full border border-border bg-card/95 p-2 shadow-lg backdrop-blur ${
          isAdmin ? "max-w-lg" : "max-w-md"
        }`}
      >
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {visibleTabs.map(({ id, label, icon: Icon, href }) => {
            const isActive = isTabActive(href);
            const accessibleLabel = id === "messages" && unreadMessageCount > 0
              ? `${label}, ${unreadMessageCount} unread`
              : label;

            return (
              <Link
                key={id}
                href={href}
                aria-label={accessibleLabel}
                className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-full px-1 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-3 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="relative">
                  <Icon size={18} aria-hidden="true" />
                  {id === "messages" && unreadMessageCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white"
                    >
                      {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                    </span>
                  )}
                </span>
                <span className="mt-1 max-w-full truncate text-[10px] font-medium sm:text-[11px]">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
        {activeTab.label}
      </div>
    </nav>
  );
}
