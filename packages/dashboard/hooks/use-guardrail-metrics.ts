import { useState, useEffect } from "react";
import type { GuardrailMetrics } from "../components/dashboard/types";

export function useGuardrailMetrics() {
  const [metrics, setMetrics] = useState<GuardrailMetrics>({
    totalCalls: 0,
    injectionsBlocked: 0,
    errors: 0,
  });
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch("/api/guardrail-metrics");
        const data = (await res.json()) as {
          totalCalls?: number;
          injectionsBlocked?: number;
          errors?: number;
          unavailable?: boolean;
        };
        if (cancelled) return;
        setActive(!data.unavailable);
        if (!data.unavailable) {
          setMetrics({
            totalCalls: data.totalCalls ?? 0,
            injectionsBlocked: data.injectionsBlocked ?? 0,
            errors: data.errors ?? 0,
          });
        }
      } catch {
        if (!cancelled) setActive(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
          timeoutId = setTimeout(() => { void poll(); }, 10_000);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  return { metrics, active, loading };
}
