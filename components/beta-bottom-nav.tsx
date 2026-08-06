"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircleMore, MessageCircle, SquarePlus, UserRound } from "lucide-react";

const tabs = [
  { id: "home", label: "Home", icon: Home, href: "/troop" },
  { id: "thoughts", label: "Thoughts", icon: MessageCircleMore, href: "/thoughts" },
  { id: "posts", label: "Posts", icon: SquarePlus, href: "/posts" },
  { id: "messages", label: "Messages", icon: MessageCircle, href: "/messages" },
  { id: "profile", label: "Profile", icon: UserRound, href: "/profile" },
] as const;

export function BetaBottomNav() {
  const pathname = usePathname();

  const activeTab = tabs.find((tab) => tab.href === pathname) ?? tabs[0];

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="w-full max-w-md rounded-full border border-[#ded8cc] bg-[#fffdf9]/95 p-2 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          {tabs.map(({ id, label, icon: Icon, href }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={id}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center rounded-full px-3 py-2 transition ${
                  isActive
                    ? "bg-[#7c9272] text-white"
                    : "text-[#625f58] hover:bg-[#f5efe5] hover:text-[#30392d]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} />
                <span className="mt-1 text-[11px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 rounded-full border border-[#ded8cc] bg-[#fffdf9] px-4 py-2 text-sm font-medium text-[#30392d] shadow-sm">
        {activeTab.label}
      </div>
    </div>
  );
}