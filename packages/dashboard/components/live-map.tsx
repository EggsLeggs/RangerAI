"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapSightingSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface MapSighting {
  lat: number;
  lng: number;
  level: MapSightingSeverity;
  label?: string;
}

const SEVERITY_COLOR: Record<MapSightingSeverity, string> = {
  CRITICAL: "#c85a3a",
  WARNING: "#d4820a",
  INFO: "#4a7c5a",
};

export function LiveMap({ sightings }: { sightings: MapSighting[] }) {
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
        m.bindPopup(s.label);
      }
      markers.push(m);
    }
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.25));
    }
  }, [sightings]);

  return (
    <div
      ref={containerRef}
      className="h-[min(70vh,560px)] w-full overflow-hidden rounded-xl border border-ranger-border bg-ranger-card"
    />
  );
}
