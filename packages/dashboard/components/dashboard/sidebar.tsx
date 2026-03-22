"use client";

import { useState, useEffect, useRef, useMemo, useId } from "react";
import { Icons } from "../icons";
import { ThreatBadge } from "./threat-badge";
import type { Breakpoint, NavSection } from "./types";
import type { RecentSightingRow } from "../../lib/types";

export function Sidebar({
  isOpen,
  onClose,
  breakpoint,
  navSections,
  notifications = [],
  unreadCount = 0,
  onNotificationsOpen,
}: {
  isOpen: boolean;
  onClose: () => void;
  breakpoint: Breakpoint;
  navSections: NavSection[];
  notifications?: RecentSightingRow[];
  unreadCount?: number;
  onNotificationsOpen?: () => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!notifOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setNotifOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notifOpen]);

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((n) => n.threat === "CRITICAL" || n.threat === "WARNING")
      .sort((a, b) => {
        const aTime = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const bTime = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 20);
  }, [notifications]);

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

      <div ref={footerRef} className="relative border-t border-ranger-border p-3">
        {notifOpen && (
          <div
            id={panelId}
            role="region"
            aria-label="Notifications"
            className="absolute bottom-full left-0 mb-1 mx-2 w-[22rem] rounded-xl border border-ranger-border bg-ranger-card shadow-xl z-50 max-h-96 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-ranger-border">
              <span className="text-sm font-medium text-ranger-text">Notifications</span>
              <button
                onClick={() => setNotifOpen(false)}
                aria-label="Close notifications"
                className="text-ranger-muted hover:text-ranger-text"
              >
                <Icons.Close />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 ranger-scrollbar">
              {filteredNotifications.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-xs text-ranger-muted">No critical alerts yet</span>
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-center justify-between gap-2 border-l-2 px-4 py-2.5 ${
                      n.threat === "CRITICAL"
                        ? "border-ranger-apricot"
                        : "border-yellow-500/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ranger-text truncate">
                        {n.species}
                      </div>
                      <div className="text-xs text-ranger-muted">
                        {n.zone} &middot; {n.time}
                      </div>
                    </div>
                    <ThreatBadge level={n.threat} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setNotifOpen((v) => !v);
            if (!notifOpen) onNotificationsOpen?.();
          }}
          aria-expanded={notifOpen}
          aria-controls={panelId}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-ranger-muted hover:bg-ranger-border/30 hover:text-ranger-text"
        >
          <div className="flex items-center gap-3">
            <Icons.Bell />
            Notifications
          </div>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ranger-apricot px-1.5 text-xs font-medium text-ranger-text">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
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
