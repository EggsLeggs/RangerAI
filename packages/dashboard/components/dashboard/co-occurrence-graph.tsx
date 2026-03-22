"use client";

import { useEffect, useRef, useState } from "react";
import * as d3Force from "d3-force";
import type { CoOccurrencePair, CoOccurrenceNode } from "../../hooks/use-co-occurrence";
import { iucnColor } from "../../lib/iucn-utils";

function nodeRadius(totalSightings: number): number {
  return Math.max(10, Math.min(28, 8 + Math.sqrt(totalSightings) * 2.5));
}

function linkWidth(count: number): number {
  return Math.max(1, Math.min(6, count * 1.5));
}

interface NodeDatum extends d3Force.SimulationNodeDatum {
  id: string;
  totalSightings: number;
  iucnStatus: string | null;
}

interface LinkDatum extends d3Force.SimulationLinkDatum<NodeDatum> {
  count: number;
}

export function CoOccurrenceGraph({
  pairs,
  nodes,
}: {
  pairs: CoOccurrencePair[];
  nodes: CoOccurrenceNode[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const linksGroupRef = useRef<SVGGElement>(null);
  const nodesGroupRef = useRef<SVGGElement>(null);
  const simRef = useRef<d3Force.Simulation<NodeDatum, LinkDatum> | null>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  // Debounced ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId = 0;
    const obs = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const r = entries[0]?.contentRect;
        if (r) setSize({ w: r.width, h: r.height });
      });
    });
    obs.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => { obs.disconnect(); cancelAnimationFrame(rafId); };
  }, []);

  // Build simulation — direct DOM writes on each tick, pointer-event drag
  useEffect(() => {
    simRef.current?.stop();
    simRef.current = null;

    const svg = svgRef.current;
    const lg = linksGroupRef.current;
    const ng = nodesGroupRef.current;
    if (!svg || !lg || !ng) return;

    while (lg.firstChild) lg.removeChild(lg.firstChild);
    while (ng.firstChild) ng.removeChild(ng.firstChild);

    if (nodes.length === 0) return;

    const { w, h } = size;
    const cx = w / 2;
    const cy = h / 2;

    // Cap to top 35 nodes, top 80 pairs
    const cappedNodes = [...nodes]
      .sort((a, b) => b.totalSightings - a.totalSightings)
      .slice(0, 35);
    const nodeSet = new Set(cappedNodes.map((n) => n.species));
    const cappedPairs = [...pairs]
      .filter((p) => nodeSet.has(p.species1) && nodeSet.has(p.species2))
      .sort((a, b) => b.count - a.count)
      .slice(0, 80);

    const nodeData: NodeDatum[] = cappedNodes.map((n) => ({
      id: n.species,
      totalSightings: n.totalSightings,
      iucnStatus: n.iucnStatus,
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 80,
    }));

    const linkData: LinkDatum[] = cappedPairs.map((p) => ({
      source: p.species1,
      target: p.species2,
      count: p.count,
    }));

    // Adjacency for hover dimming
    const adjacency = new Map<string, Set<string>>();
    for (const p of cappedPairs) {
      if (!adjacency.has(p.species1)) adjacency.set(p.species1, new Set());
      if (!adjacency.has(p.species2)) adjacency.set(p.species2, new Set());
      adjacency.get(p.species1)!.add(p.species2);
      adjacency.get(p.species2)!.add(p.species1);
    }

    // Create link elements
    const linkEls: SVGLineElement[] = cappedPairs.map((l) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("stroke", "#4a7c5a");
      line.setAttribute("stroke-width", String(linkWidth(l.count)));
      line.setAttribute("opacity", "0.6");
      lg.appendChild(line);
      return line;
    });

    // Drag state
    let dragging: NodeDatum | null = null;

    // Create node elements
    type NodeEl = { g: SVGGElement; circle: SVGCircleElement; id: string };
    const nodeEls: NodeEl[] = nodeData.map((n) => {
      const r = nodeRadius(n.totalSightings);
      const color = iucnColor(n.iucnStatus);

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.style.cursor = "grab";

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", String(r));
      circle.setAttribute("fill", color);
      circle.setAttribute("fill-opacity", "0.85");
      circle.setAttribute("stroke", color);
      circle.setAttribute("stroke-width", "1.5");

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("y", String(r + 12));
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "#7A7670");
      label.setAttribute("pointer-events", "none");
      label.textContent = n.id.length > 16 ? n.id.slice(0, 15) + "…" : n.id;

      g.appendChild(circle);
      g.appendChild(label);
      ng.appendChild(g);

      // Hover dimming
      g.addEventListener("mouseenter", () => {
        if (dragging) return;
        const connected = adjacency.get(n.id) ?? new Set();
        nodeEls.forEach((ne) => {
          const dim = ne.id !== n.id && !connected.has(ne.id);
          ne.circle.setAttribute("fill-opacity", dim ? "0.15" : "0.85");
          ne.circle.setAttribute("opacity", dim ? "0.2" : "1");
        });
        linkEls.forEach((le, i) => {
          const ld = linkData[i]!;
          const src = typeof ld.source === "object" ? (ld.source as NodeDatum).id : ld.source;
          const tgt = typeof ld.target === "object" ? (ld.target as NodeDatum).id : ld.target;
          le.setAttribute("opacity", src !== n.id && tgt !== n.id ? "0.1" : "0.7");
        });
      });

      g.addEventListener("mouseleave", () => {
        if (dragging) return;
        nodeEls.forEach((ne) => {
          ne.circle.setAttribute("fill-opacity", "0.85");
          ne.circle.setAttribute("opacity", "1");
        });
        linkEls.forEach((le) => le.setAttribute("opacity", "0.6"));
      });

      // Drag: fix the node position on pointerdown, follow on pointermove
      g.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = n;
        n.fx = n.x;
        n.fy = n.y;
        g.style.cursor = "grabbing";
        g.setPointerCapture(e.pointerId);
        simRef.current?.alphaTarget(0.3).restart();
      });

      g.addEventListener("pointermove", (e) => {
        if (dragging !== n) return;
        const rect = svg.getBoundingClientRect();
        n.fx = Math.max(30, Math.min(w - 30, e.clientX - rect.left));
        n.fy = Math.max(30, Math.min(h - 30, e.clientY - rect.top));
      });

      const cleanupDrag = (e?: PointerEvent) => {
        if (dragging !== n) return;
        dragging = null;
        n.vx = 0;
        n.vy = 0;
        n.fx = null;
        n.fy = null;
        g.style.cursor = "grab";
        simRef.current?.alphaTarget(0);
        if (e) {
          try { g.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        }
      };

      g.addEventListener("pointerup", (e) => cleanupDrag(e));
      g.addEventListener("pointercancel", (e) => cleanupDrag(e));
      g.addEventListener("lostpointercapture", (e) => cleanupDrag(e));

      return { g, circle, id: n.id };
    });

    const sim = d3Force
      .forceSimulation<NodeDatum, LinkDatum>(nodeData)
      .force(
        "link",
        d3Force
          .forceLink<NodeDatum, LinkDatum>(linkData)
          .id((d) => d.id)
          .distance(160)
      )
      // limit repulsion range so distant nodes don't push each other to the boundary
      .force("charge", d3Force.forceManyBody<NodeDatum>().strength(-250).distanceMax(200))
      // weak per-node pull toward centre keeps the cluster from drifting to edges
      .force("x", d3Force.forceX<NodeDatum>(cx).strength(0.06))
      .force("y", d3Force.forceY<NodeDatum>(cy).strength(0.06))
      .force("collide", d3Force.forceCollide<NodeDatum>(38))
      .alphaDecay(0.03);

    sim.on("tick", () => {
      const resolvedLinks = (
        sim.force("link") as d3Force.ForceLink<NodeDatum, LinkDatum>
      ).links();

      resolvedLinks.forEach((l, i) => {
        const src = l.source as NodeDatum;
        const tgt = l.target as NodeDatum;
        const el = linkEls[i];
        if (!el) return;
        el.setAttribute("x1", String(Math.max(30, Math.min(w - 30, src.x ?? cx))));
        el.setAttribute("y1", String(Math.max(30, Math.min(h - 30, src.y ?? cy))));
        el.setAttribute("x2", String(Math.max(30, Math.min(w - 30, tgt.x ?? cx))));
        el.setAttribute("y2", String(Math.max(30, Math.min(h - 30, tgt.y ?? cy))));
      });

      nodeData.forEach((n, i) => {
        const el = nodeEls[i];
        if (!el) return;
        const x = Math.max(30, Math.min(w - 30, n.x ?? cx));
        const y = Math.max(30, Math.min(h - 30, n.y ?? cy));
        el.g.setAttribute("transform", `translate(${x},${y})`);
      });
    });

    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [nodes, pairs, size]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ranger-muted">
        No co-occurrence data for this period
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg ref={svgRef} width={size.w} height={size.h} style={{ touchAction: "none" }}>
        <g ref={linksGroupRef} />
        <g ref={nodesGroupRef} />
      </svg>
    </div>
  );
}
