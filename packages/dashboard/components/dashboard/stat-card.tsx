"use client";

import { useCountUp } from "../../hooks/use-count-up";
import { Icons } from "../icons";
import { Card } from "../ui/card";

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  visible,
  delay,
  loading,
  error,
}: {
  title: string;
  value: number;
  subtitle: string;
  trend: "up" | "down";
  visible: boolean;
  delay: number;
  loading?: boolean;
  error?: boolean;
}) {
  const count = useCountUp(visible && !loading && !error ? value : 0, 1500);

  return (
    <Card
      className="p-5 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="text-sm text-ranger-muted">{title}</div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-3xl font-semibold text-ranger-text">
          {loading ? "—" : error ? "!" : count}
        </span>
        <span
          aria-label={trend === "up" ? "Up trend" : "Down trend"}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            trend === "up"
              ? "bg-ranger-moss/20 text-ranger-moss"
              : "bg-ranger-apricot/20 text-ranger-apricot"
          }`}
        >
          {trend === "up" ? <Icons.ArrowUp /> : <Icons.ArrowDown />}
        </span>
      </div>
      <div className="mt-1 text-sm text-ranger-muted">{subtitle}</div>
    </Card>
  );
}
