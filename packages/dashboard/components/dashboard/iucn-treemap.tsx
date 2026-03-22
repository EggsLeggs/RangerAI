"use client";

import { Treemap, ResponsiveContainer } from "recharts";
import type { IucnBreakdownItem } from "../../hooks/use-threat-breakdown";
import { iucnColor } from "../../lib/iucn-utils";

interface TreeNode {
  name: string;
  size: number;
  fill: string;
}

interface CustomContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
}

function CustomContent(props: CustomContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", fill = "#4a7c5a" } = props;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={3} />
      {width > 40 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={Math.min(13, width / 6)}
          fontWeight="600"
        >
          {name}
        </text>
      )}
    </g>
  );
}

export function IucnTreemap({ data }: { data: IucnBreakdownItem[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-ranger-muted">
        No IUCN data
      </div>
    );
  }

  const treeData: TreeNode[] = data.map((d) => ({
    name: `${d.status} (${d.count})`,
    size: d.count,
    fill: iucnColor(d.status),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <Treemap
        data={treeData}
        dataKey="size"
        nameKey="name"
        content={<CustomContent />}
      />
    </ResponsiveContainer>
  );
}
