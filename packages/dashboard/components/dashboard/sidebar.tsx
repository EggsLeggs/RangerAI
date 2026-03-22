"use client";

import { Icons } from "../icons";
import type { Breakpoint, NavSection } from "./types";

export function Sidebar({
  isOpen,
  onClose,
  breakpoint,
  navSections,
  notificationsCount = 0,
}: {
  isOpen: boolean;
  onClose: () => void;
  breakpoint: Breakpoint;
  navSections: NavSection[];
  notificationsCount?: number;
}) {
  const sidebarContent = (
    <div className="flex h-full flex-col bg-ranger-card">
      <div className="flex h-[72px] items-center gap-3 border-b border-ranger-border px-4">
        <span className="text-lg font-semibold text-ranger-text">RangerAI</span>
        {breakpoint === "mobile" && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto text-ranger-muted hover:text-ranger-text"
          >
            <Icons.Close />
          </button>
        )}
      </div>

      <div className="border-b border-ranger-border p-4">
        <button className="flex w-full items-center justify-between rounded-lg bg-ranger-border/50 p-3 text-left">
          <div>
            <div className="text-sm font-medium text-ranger-text">Serengeti Reserve</div>
            <div className="text-xs text-ranger-muted">12 zones monitored</div>
          </div>
          <span className="text-ranger-text"><Icons.ChevronDown /></span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="mb-2 px-3 text-xs font-medium uppercase tracking-widest text-ranger-muted">
              {section.title}
            </div>
            {section.items.map((item) => (
              <button
                key={`${section.title}-${item.name}`}
                type="button"
                onClick={() => {
                  item.onSelect?.();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  item.active
                    ? "border border-ranger-moss/30 bg-ranger-border/50 text-ranger-text"
                    : "text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text"
                }`}
              >
                {item.icon}
                {item.name}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-ranger-border p-3">
        <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text">
          <div className="flex items-center gap-3">
            <Icons.Bell />
            Notifications
          </div>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ranger-apricot px-1.5 text-xs font-medium text-ranger-text">
            {notificationsCount}
          </span>
        </button>
      </div>
    </div>
  );

  if (breakpoint === "mobile" || breakpoint === "tablet") {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        )}
        <div
          className={`fixed left-0 top-0 z-50 h-full w-[280px] transform transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div className="fixed left-0 top-0 h-[calc(100%-40px)] w-[220px]">
      {sidebarContent}
    </div>
  );
}
