"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { id: "home", label: "Home", icon: "/icons/nav/home.png", iconActive: "/icons/nav/home-active.png", href: "/troop" },
  { id: "thoughts", label: "Thoughts", icon: "/icons/nav/thoughts.png", iconActive: "/icons/nav/thoughts-active.png", href: "/thoughts" },
  { id: "posts", label: "Posts", icon: "/icons/nav/post.png", iconActive: "/icons/nav/post-active.png", href: "/posts" },
  { id: "messages", label: "Messages", icon: "/icons/nav/messages.png", iconActive: "/icons/nav/messages-active.png", href: "/messages" },
  { id: "profile", label: "Profile", icon: "/icons/nav/profile.png", iconActive: "/icons/nav/profile-active.png", href: "/profile" },
] as const;

export function BetaBottomNav({
  unreadMessageCount = 0,
}: {
  unreadMessageCount?: number;
}) {
  const pathname = usePathname();
  const isTabActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const activeTab = tabs.find((tab) => isTabActive(tab.href)) ?? tabs[0];

  return (
    <nav
      aria-label="Beta app navigation"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-2 sm:px-4"
    >
      <div className="w-full max-w-md rounded-full border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {tabs.map(({ id, label, icon, iconActive, href }) => {
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
                    ? "bg-secondary"
                    : "hover:bg-muted"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="relative flex size-6 items-center justify-center">
                  <Image
                    src={isActive ? iconActive : icon}
                    alt=""
                    width={24}
                    height={24}
                    aria-hidden="true"
                    className="size-full object-contain"
                  />
                  {id === "messages" && unreadMessageCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white"
                    >
                      {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                    </span>
                  )}
                </span>
                <span
                  className={`mt-1 max-w-full truncate text-[10px] font-medium sm:text-[11px] ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
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
