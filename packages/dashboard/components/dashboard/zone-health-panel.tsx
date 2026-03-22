"use client";

import { useCountUp } from "../../hooks/use-count-up";
import { useStaggeredMount } from "../../hooks/use-staggered-mount";
import { Icons } from "../icons";
import { Card } from "../ui/card";
import { ZoneProgressBar } from "./zone-progress-bar";
import type { ZoneData } from "../../hooks/use-zone-health";

export function ZoneHealthPanel({
  zones,
  totalAnimals,
  loading,
}: {
  zones: ZoneData[];
  totalAnimals: number;
  loading: boolean;
}) {
  const zonesVisible = useStaggeredMount(Math.max(zones.length, 4), 100);
  const zoneAnimalCount = useCountUp(totalAnimals, 1500);

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-ranger-text">Zone Health</h2>
      <div className="mb-4">
        <div className="text-3xl font-semibold text-ranger-text">
          {zoneAnimalCount} Animals
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <div className="text-ranger-moss">
            <Icons.Stable />
          </div>
          <span className="text-sm text-ranger-muted">Stable Population</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-ranger-apricot">
            <Icons.Risk />
          </div>
          <span className="text-sm text-ranger-muted">At Risk Population</span>
        </div>
      </div>
      <div className="space-y-1">
        {loading && zones.length === 0
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="py-2 opacity-30">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="h-4 w-24 rounded bg-ranger-border" />
                  <span className="h-4 w-8 rounded bg-ranger-border" />
                </div>
                <div className="h-2 w-full rounded-full bg-ranger-border">
                  <div className="h-2 w-[30%] rounded-full bg-ranger-border" />
                </div>
              </div>
            ))
          : zones.map((zone, i) => (
              <ZoneProgressBar
                key={zone.id}
                name={`${zone.id} · ${zone.name}`}
                coverage={zone.coverage}
                color={zone.color}
                visible={zonesVisible[i] ?? false}
                delay={i * 100}
              />
            ))}
      </div>
    </Card>
  );
}
