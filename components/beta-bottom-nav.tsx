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

  return (
    <nav
      aria-label="Beta app navigation"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-2 sm:px-4"
    >
      <div className="flex h-16 w-full max-w-md justify-between gap-1 rounded-2xl border border-border bg-card/95 px-3 shadow-lg backdrop-blur sm:gap-2 sm:px-5">
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
              className="relative flex min-w-0 flex-1 flex-col items-center justify-end rounded-xl pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative -mt-9 flex size-14 items-center justify-center drop-shadow-md transition hover:scale-105 sm:size-16">
                <Image
                  src={isActive ? iconActive : icon}
                  alt=""
                  width={64}
                  height={64}
                  aria-hidden="true"
                  className="size-full object-contain"
                />
                {id === "messages" && unreadMessageCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white"
                  >
                    {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                  </span>
                )}
              </span>
              <span
                className={`max-w-full truncate text-[10px] font-medium sm:text-[11px] ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
