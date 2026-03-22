"use client";

import { Icons } from "../icons";

export function Header({
  pageTitle,
  isDesktop,
  onOpenSidebar,
}: {
  pageTitle: string;
  isDesktop: boolean;
  onOpenSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 h-[72px] border-b border-ranger-border bg-ranger-bg px-4 md:px-6">
      <div className="flex h-full items-center justify-between">
        <div className="flex items-center gap-4">
          {!isDesktop && (
            <button
              type="button"
              onClick={onOpenSidebar}
              aria-label="Open navigation"
              className="text-ranger-muted hover:text-ranger-text"
            >
              <Icons.Menu />
            </button>
          )}
          <h1 className="text-xl font-semibold text-ranger-text md:text-2xl">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-ranger-border bg-ranger-card px-3 py-2 sm:flex">
            <Icons.Search />
            <input
              type="text"
              placeholder="Search..."
              aria-label="Search"
              className="w-32 bg-transparent text-sm text-ranger-text placeholder-ranger-muted outline-none lg:w-48"
            />
          </div>

        </div>
      </div>
    </header>
  );
}
