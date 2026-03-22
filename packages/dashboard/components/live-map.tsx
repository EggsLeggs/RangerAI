"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapSightingSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface MapSighting {
  id?: string;
  alertId?: string;
  lat: number;
  lng: number;
  level: MapSightingSeverity;
  label?: string;
  timestamp?: Date;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const SEVERITY_COLOR: Record<MapSightingSeverity, string> = {
  CRITICAL: "#c85a3a",
  WARNING: "#d4820a",
  INFO: "#4a7c5a",
};

export function LiveMap({
  sightings,
  onBoundsChange,
  onPinClick,
  fitKey,
}: {
  sightings: MapSighting[];
  onBoundsChange?: (bounds: MapBounds) => void;
  onPinClick?: (sighting: MapSighting) => void;
  fitKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const lastFitKeyRef = useRef(-1);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([-2.35, 34.85], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const emitBounds = () => {
      if (!onBoundsChangeRef.current) return;
      const b = map.getBounds();
      onBoundsChangeRef.current({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    };

    map.on("moveend", emitBounds);
    map.on("zoomend", emitBounds);
    // emit once map is ready
    map.whenReady(emitBounds);

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
    const markers: L.Layer[] = [];
    for (const s of sightings) {
      const m = L.circleMarker([s.lat, s.lng], {
        radius: 8,
        color: SEVERITY_COLOR[s.level],
        fillColor: SEVERITY_COLOR[s.level],
        fillOpacity: 0.88,
        weight: 2,
      }).addTo(layer);
      if (s.label) {
        const el = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = s.label;
        el.appendChild(strong);
        if (s.timestamp) {
          el.appendChild(document.createElement("br"));
          const tsEl = document.createElement("span");
          tsEl.style.fontSize = "11px";
          tsEl.style.opacity = "0.7";
          tsEl.textContent = s.timestamp.toLocaleString();
          el.appendChild(tsEl);
        }
        m.bindPopup(el);
      }
      m.on("click", () => onPinClick?.(s));
      markers.push(m);
    }
    const shouldFit = fitKey !== undefined && fitKey !== lastFitKeyRef.current;
    if (markers.length > 0 && shouldFit) {
      lastFitKeyRef.current = fitKey!;
      const group = L.featureGroup(markers);
      // defer until after browser paint so the container has proper dimensions
      requestAnimationFrame(() => {
        if (!mapRef.current) return;
        mapRef.current.invalidateSize();
        mapRef.current.fitBounds(group.getBounds().pad(0.25));
      });
    }
  }, [sightings, fitKey, onPinClick]);

  return (
    <div
      ref={containerRef}
      className="h-[min(70vh,560px)] w-full overflow-hidden rounded-xl border border-ranger-border bg-ranger-card"
    />
  );
}
