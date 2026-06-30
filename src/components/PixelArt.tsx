import type { ReactElement } from "react";
import { PIXEL_INK, type SeasonShades } from "./seasonArt.ts";

const tokenColor = (t: string, s: SeasonShades): string | null => {
  switch (t) {
    case "1":
      return s.l;
    case "2":
      return s.b;
    case "3":
      return s.d;
    case "4":
      return s.h;
    case "5":
      return PIXEL_INK;
    case "6":
      return "#3b82f6";
    default:
      return null;
  }
};

interface PixelSpriteProps {
  rows: readonly string[];
  shades: SeasonShades;
  className?: string;
}

export function PixelSprite({
  rows,
  shades,
  className,
}: PixelSpriteProps): ReactElement {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const rects: ReactElement[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = tokenColor(row[x], shades);
      if (color === null) {
        x += 1;
        continue;
      }
      let run = 1;
      while (
        x + run < row.length &&
        tokenColor(row[x + run], shades) === color
      ) {
        run += 1;
      }
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={run}
          height={1}
          fill={color}
        />,
      );
      x += run;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}
