import { describe, it, expect, beforeEach } from "bun:test";
import { SightingQueue } from "./queue";
import type { Sighting } from "@rangerwatch/shared";

function makeSighting(id: string, source: "inaturalist" | "gbif" = "inaturalist"): Sighting {
  return {
    id,
    source,
    imageUrl: `https://example.com/${id}.jpg`,
    lat: 0,
    lng: 0,
    observedAt: new Date("2024-01-01T00:00:00Z"),
  };
}

describe("SightingQueue", () => {
  let queue: SightingQueue;

  beforeEach(() => {
    queue = new SightingQueue();
  });

  it("enqueues and dequeues in FIFO order", () => {
    const a = makeSighting("1");
    const b = makeSighting("2");
    queue.enqueue(a);
    queue.enqueue(b);
    expect(queue.size).toBe(2);
    expect(queue.dequeue()).toEqual(a);
    expect(queue.dequeue()).toEqual(b);
    expect(queue.dequeue()).toBeUndefined();
    expect(queue.size).toBe(0);
  });

  it("deduplicates by id + source composite key", () => {
    const s = makeSighting("42", "inaturalist");
    expect(queue.enqueue(s)).toBe(true);
    expect(queue.enqueue(s)).toBe(false);
    // same id, different source - should be admitted
    expect(queue.enqueue(makeSighting("42", "gbif"))).toBe(true);
    expect(queue.size).toBe(2);
  });

  it("removes dequeued ids from seen so they can be re-enqueued", () => {
    queue.enqueue(makeSighting("1"));
    queue.enqueue(makeSighting("2"));
    queue.dequeue();
    expect(queue.seenIds).toBe(1);
    // re-enqueue dequeued id - should be admitted after seen cleanup
    expect(queue.enqueue(makeSighting("1"))).toBe(true);
  });

  it("enforces max capacity by dropping the oldest item", () => {
    for (let i = 0; i < 500; i++) {
      queue.enqueue(makeSighting(String(i)));
    }
    expect(queue.size).toBe(500);
    // adding one more should evict id "0"
    queue.enqueue(makeSighting("500"));
    expect(queue.size).toBe(500);
    expect(queue.dequeue()?.id).toBe("1");
    // evicted id "0" is removed from seen - can be enqueued again
    expect(queue.enqueue(makeSighting("0"))).toBe(true);
  });

  it("peek returns a copy without mutating the queue", () => {
    queue.enqueue(makeSighting("x"));
    const snapshot = queue.peek();
    snapshot.pop();
    expect(queue.size).toBe(1);
    expect(queue.peek()).toHaveLength(1);
  });
});
