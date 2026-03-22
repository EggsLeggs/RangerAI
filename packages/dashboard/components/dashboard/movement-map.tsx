"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MovementSighting } from "../../hooks/use-animal-movement";

type Severity = "CRITICAL" | "WARNING" | "INFO" | "NEEDS_REVIEW";

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "#c85a3a",
  WARNING: "#d4820a",
  INFO: "#4a7c5a",
  NEEDS_REVIEW: "#b8a038",
};

function severityColor(tl: string): string {
  if (tl === "CRITICAL" || tl === "WARNING" || tl === "INFO" || tl === "NEEDS_REVIEW")
    return SEVERITY_COLOR[tl];
  return SEVERITY_COLOR.INFO;
}

export function MovementMap({ sightings }: { sightings: MovementSighting[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([-2.35, 34.85], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (sightings.length === 0) return;

    const coords: [number, number][] = sightings.map((s) => [s.lat, s.lng]);

    // dashed polyline trail
    L.polyline(coords, {
      color: "#B86F0A",
      weight: 2,
      opacity: 0.7,
      dashArray: "6 4",
    }).addTo(layer);

    sightings.forEach((s, i) => {
      const color = severityColor(s.threatLevel);
      const isLast = i === sightings.length - 1;

      // out-of-range outer ring
      if (!s.inRange) {
        L.circleMarker([s.lat, s.lng], {
          radius: 16,
          color: "#c85a3a",
          fillOpacity: 0,
          weight: 1.5,
          opacity: 0.4,
        }).addTo(layer);
      }

      const m = L.circleMarker([s.lat, s.lng], {
        radius: isLast ? 10 : 7,
        color,
        fillColor: color,
        fillOpacity: isLast ? 0.95 : 0.7,
        weight: isLast ? 3 : 2,
      }).addTo(layer);

      if (s.timestamp) {
        const el = document.createElement("div");
        const tsEl = document.createElement("span");
        tsEl.textContent = new Date(s.timestamp).toLocaleString();
        tsEl.style.fontSize = "11px";
        el.appendChild(tsEl);
        if (s.anomalyScore !== null) {
          el.appendChild(document.createElement("br"));
          const scoreEl = document.createElement("span");
          scoreEl.textContent = `Anomaly: ${s.anomalyScore}`;
          scoreEl.style.fontSize = "11px";
          scoreEl.style.opacity = "0.7";
          el.appendChild(scoreEl);
        }
        m.bindPopup(el);
      }
    });

    // fit to sightings
    requestAnimationFrame(() => {
      if (!mapRef.current || sightings.length === 0) return;
      const group = L.featureGroup(
        sightings.map((s) => L.circleMarker([s.lat, s.lng], { radius: 1 }))
      );
      mapRef.current.invalidateSize();
      mapRef.current.fitBounds(group.getBounds().pad(0.25));
    });
  }, [sightings]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-xl border border-ranger-border bg-ranger-card"
    />
  );
}
