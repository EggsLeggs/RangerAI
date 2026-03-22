"use client";

import { useState, useEffect } from "react";

export function ZoneProgressBar({
  name,
  coverage,
  color,
  visible,
  delay,
}: {
  name: string;
  coverage: number;
  color: string;
  visible: boolean;
  delay: number;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setWidth(coverage), delay);
      return () => clearTimeout(timer);
    }
  }, [visible, coverage, delay]);

  return (
    <div className="py-2">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-ranger-text">{name}</span>
        <span className="text-ranger-muted">{coverage}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-ranger-border">
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
