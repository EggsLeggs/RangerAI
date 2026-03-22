import { useState, useEffect } from "react";
import type { Breakpoint } from "../components/dashboard/types";

export function useWindowSize() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint | null>(null);

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint("mobile");
      } else if (width < 1080) {
        setBreakpoint("tablet");
      } else {
        setBreakpoint("desktop");
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return breakpoint;
}
