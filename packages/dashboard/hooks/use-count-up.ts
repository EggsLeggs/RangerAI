import { useState, useEffect, useRef } from "react";

export function useCountUp(target: number, duration: number = 1500) {
  const [count, setCount] = useState(0);
  const currentRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startValue = currentRef.current;
    startTimeRef.current = null;

    if (duration <= 0) {
      currentRef.current = target;
      setCount(target);
      return;
    }

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const next = Math.floor(startValue + easedProgress * (target - startValue));
      currentRef.current = next;
      setCount(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        currentRef.current = target;
        setCount(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}
