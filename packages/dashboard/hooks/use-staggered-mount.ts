import { useState, useEffect } from "react";

export function useStaggeredMount(itemCount: number, baseDelay: number = 100) {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(
    Array(itemCount).fill(false)
  );

  useEffect(() => {
    setVisibleItems(Array(itemCount).fill(false));
    const timeouts: NodeJS.Timeout[] = [];

    for (let i = 0; i < itemCount; i++) {
      timeouts.push(
        setTimeout(() => {
          setVisibleItems((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, baseDelay * (i + 1))
      );
    }

    return () => timeouts.forEach(clearTimeout);
  }, [itemCount, baseDelay]);

  return visibleItems;
}
