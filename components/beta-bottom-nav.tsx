"use client";

import { useState } from "react";
import { Home, MessageCircleMore, MessageCircle, SquarePlus, UserRound } from "lucide-react";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "thoughts", label: "Thoughts", icon: MessageCircleMore },
  { id: "posts", label: "Posts", icon: SquarePlus },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: UserRound },
] as const;

export function BetaBottomNav() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("home");

  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? "Home";

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="w-full max-w-md rounded-full border border-[#ded8cc] bg-[#fffdf9]/95 p-2 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex flex-1 flex-col items-center justify-center rounded-full px-3 py-2 transition ${
                  isActive
                    ? "bg-[#7c9272] text-white"
                    : "text-[#625f58] hover:bg-[#f5efe5] hover:text-[#30392d]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} />
                <span className="mt-1 text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 rounded-full border border-[#ded8cc] bg-[#fffdf9] px-4 py-2 text-sm font-medium text-[#30392d] shadow-sm">
        {activeLabel}
      </div>
    </div>
  );
}
