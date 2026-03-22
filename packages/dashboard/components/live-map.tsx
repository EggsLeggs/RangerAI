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

function zoneIdFromCoords(lat: number, lng: number): string {
  const n = Math.abs(Math.floor(lat * 10 + lng * 10)) % 99;
  return "ZN-" + String(n).padStart(2, "0");
}

export function LiveMap({
  sightings,
  onBoundsChange,
  onPinClick,
  fitKey,
  hoveredZone,
}: {
  sightings: MapSighting[];
  onBoundsChange?: (bounds: MapBounds) => void;
  onPinClick?: (sighting: MapSighting) => void;
  fitKey?: number;
  hoveredZone?: { id: string; color: string } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const zoneRectRef = useRef<L.Rectangle | null>(null);
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
    map.whenReady(emitBounds);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      zoneRectRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    // clear previous zone rectangle
    if (zoneRectRef.current) {
      zoneRectRef.current.remove();
      zoneRectRef.current = null;
    }

    layer.clearLayers();
    const markers: L.Layer[] = [];
    const zoneLats: number[] = [];
    const zoneLngs: number[] = [];

    for (const s of sightings) {
      const inHoveredZone = hoveredZone
        ? zoneIdFromCoords(s.lat, s.lng) === hoveredZone.id
        : false;
      const dimmed = hoveredZone !== null && hoveredZone !== undefined && !inHoveredZone;

      const m = L.circleMarker([s.lat, s.lng], {
        radius: inHoveredZone ? 10 : 8,
        color: SEVERITY_COLOR[s.level],
        fillColor: SEVERITY_COLOR[s.level],
        fillOpacity: dimmed ? 0.15 : 0.88,
        weight: inHoveredZone ? 3 : 2,
        opacity: dimmed ? 0.2 : 1,
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

      if (inHoveredZone) {
        zoneLats.push(s.lat);
        zoneLngs.push(s.lng);
      }

      m.on("click", () => onPinClick?.(s));
      markers.push(m);
    }

    // draw bounding box around the hovered zone's sightings
    if (hoveredZone && zoneLats.length > 0) {
      const minLat = Math.min(...zoneLats);
      const maxLat = Math.max(...zoneLats);
      const minLng = Math.min(...zoneLngs);
      const maxLng = Math.max(...zoneLngs);
      const latPad = Math.max((maxLat - minLat) * 0.4, 0.08);
      const lngPad = Math.max((maxLng - minLng) * 0.4, 0.08);

      zoneRectRef.current = L.rectangle(
        [[minLat - latPad, minLng - lngPad], [maxLat + latPad, maxLng + lngPad]],
        {
          color: hoveredZone.color,
          weight: 2,
          fillColor: hoveredZone.color,
          fillOpacity: 0.08,
          dashArray: "6 4",
          interactive: false,
        }
      ).addTo(map);
    }

    const shouldFit = fitKey !== undefined && fitKey !== lastFitKeyRef.current;
    if (markers.length > 0 && shouldFit) {
      lastFitKeyRef.current = fitKey!;
      const group = L.featureGroup(markers);
      requestAnimationFrame(() => {
        if (!mapRef.current) return;
        mapRef.current.invalidateSize();
        mapRef.current.fitBounds(group.getBounds().pad(0.25));
      });
    }
  }, [sightings, fitKey, hoveredZone, onPinClick]);

  return (
    <div
      ref={containerRef}
      className="h-[min(70vh,560px)] w-full overflow-hidden rounded-xl border border-ranger-border bg-ranger-card"
    />
  );
}
