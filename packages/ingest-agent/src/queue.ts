import type { Sighting, SightingSource } from "@rangerai/shared";

const MAX_CAPACITY = 500;

function compositeKey(source: SightingSource, id: string): string {
  return `${source}:${id}`;
}

export class SightingQueue {
  private readonly items: Sighting[] = [];
  private readonly seen: Map<string, boolean> = new Map();

  enqueue(sighting: Sighting): boolean {
    const key = compositeKey(sighting.source, sighting.id);
    if (this.seen.has(key)) {
      return false;
    }
    this.seen.set(key, true);
    if (this.items.length >= MAX_CAPACITY) {
      const evicted = this.items.shift();
      if (evicted) {
        this.seen.delete(compositeKey(evicted.source, evicted.id));
      }
    }
    this.items.push(sighting);
    return true;
  }

  dequeue(): Sighting | undefined {
    const item = this.items.shift();
    if (item) {
      this.seen.delete(compositeKey(item.source, item.id));
    }
    return item;
  }

  peek(): Sighting[] {
    return [...this.items];
  }

  get size(): number {
    return this.items.length;
  }

  get seenIds(): number {
    return this.seen.size;
  }
}

export const defaultQueue = new SightingQueue();
