import { memo } from "react";
import type { Grid } from "@/lib/game/pixels";

/**
 * Draws a pixel grid as crisp SVG squares. Runs of the same colour in a row
 * become one rectangle, so even the hero is only a few hundred shapes.
 */
export const PixelArt = memo(function PixelArt({
  grid,
  scale = 4,
  className,
  title,
  flip = false,
}: {
  grid: Grid;
  scale?: number;
  className?: string;
  title?: string;
  flip?: boolean;
}) {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const rects: { x: number; y: number; w: number; c: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const c = row[x];
      if (!c) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < w && row[end] === c) end++;
      rects.push({ x, y, w: end - x, c });
      x = end;
    }
  });
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  );
});
