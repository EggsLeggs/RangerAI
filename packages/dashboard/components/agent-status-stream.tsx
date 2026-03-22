"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AgentStatusStreamState = "connecting" | "live" | "offline";

type AgentStatusMessageListener = (msg: Record<string, unknown>) => void;

export type AgentStatusStreamContextValue = {
  streamState: AgentStatusStreamState;
  paused: boolean;
  subscribe: (listener: AgentStatusMessageListener) => () => void;
};

const AgentStatusStreamContext = createContext<AgentStatusStreamContextValue | null>(
  null
);

export function AgentStatusStreamProvider({ children }: { children: ReactNode }) {
  const [streamState, setStreamState] = useState<AgentStatusStreamState>("connecting");
  const [paused, setPaused] = useState(false);
  const listenersRef = useRef(new Set<AgentStatusMessageListener>());

  const subscribe = useCallback((listener: AgentStatusMessageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const emit = (msg: Record<string, unknown>) => {
      for (const fn of listenersRef.current) {
        try {
          fn(msg);
        } catch (e) {
          console.error("[agent-status-stream] listener error", e);
        }
      }
    };

    const connect = () => {
      if (closed) return;
      es?.close();
      setStreamState((s) => (s === "live" ? s : "connecting"));
      es = new EventSource("/api/agent-status");
      es.onopen = () => {
        if (!closed) setStreamState("live");
      };
      es.onmessage = (ev: MessageEvent) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data) as Record<string, unknown>;
        } catch {
          return;
        }
        attempt = 0;

        if (msg.type === "unavailable") {
          setStreamState("offline");
          return;
        }

        if (msg.type === "paused" && typeof msg.paused === "boolean") {
          setPaused(msg.paused);
          return;
        }

        if (msg.type === "init" && msg.state && typeof msg.state === "object") {
          if (typeof msg.paused === "boolean") setPaused(msg.paused);
          emit(msg);
          return;
        }

        emit(msg);
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (!closed) setStreamState("offline");
        if (closed) return;
        attempt += 1;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 5));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ streamState, paused, subscribe }),
    [streamState, paused, subscribe]
  );

  return (
    <AgentStatusStreamContext.Provider value={value}>
      {children}
    </AgentStatusStreamContext.Provider>
  );
}

export function useAgentStatusStream(): AgentStatusStreamContextValue {
  const ctx = useContext(AgentStatusStreamContext);
  if (!ctx) {
    throw new Error("useAgentStatusStream must be used within AgentStatusStreamProvider");
  }
  return ctx;
}
