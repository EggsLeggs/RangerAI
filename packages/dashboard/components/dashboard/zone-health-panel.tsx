"use client";

import { useCountUp } from "../../hooks/use-count-up";
import { useStaggeredMount } from "../../hooks/use-staggered-mount";
import { Icons } from "../icons";
import { Card } from "../ui/card";
import { zoneHealthData } from "../../lib/constants";
import { ZoneProgressBar } from "./zone-progress-bar";

export function ZoneHealthPanel() {
  const zonesVisible = useStaggeredMount(zoneHealthData.length, 100);
  const zoneAnimalCount = useCountUp(847, 1500);

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
        {zoneHealthData.map((zone, i) => (
          <ZoneProgressBar
            key={zone.name}
            name={zone.name}
            coverage={zone.coverage}
            color={zone.color}
            visible={zonesVisible[i]}
            delay={i * 100}
          />
        ))}
      </div>
    </Card>
  );
}
