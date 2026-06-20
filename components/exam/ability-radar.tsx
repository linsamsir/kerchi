"use client";

import { useEffect, useRef, useState } from "react";
import type { RadarAxis } from "@/lib/exam";

/** 能力值雷達圖（>=3 軸）/ 長條圖（<3 軸），帶生長動畫。 */
export function AbilityRadar({ data }: { data: RadarAxis[] }) {
  const [t, setT] = useState(0); // 動畫進度 0→1
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      // easeOutCubic
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [data]);

  if (data.length === 0) return null;

  if (data.length < 3) {
    return (
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.axis}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{d.axis}</span>
              <span className="tnum text-muted-foreground">
                {d.correct}/{d.total} · {d.value}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-none"
                style={{ width: `${d.value * t}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 56;
  const n = data.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];

  const rings = [0.25, 0.5, 0.75, 1];
  const gridPoly = (frac: number) =>
    data.map((_, i) => point(i, R * frac).join(",")).join(" ");
  const dataPoly = data.map((d, i) => point(i, R * (d.value / 100) * t).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-sm">
      {/* 同心格線 */}
      {rings.map((f) => (
        <polygon
          key={f}
          points={gridPoly(f)}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      ))}
      {/* 軸線 */}
      {data.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
      })}
      {/* 資料多邊形 */}
      <polygon
        points={dataPoly}
        fill="color-mix(in srgb, var(--color-primary) 25%, transparent)"
        stroke="var(--color-primary)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* 頂點 */}
      {data.map((d, i) => {
        const [x, y] = point(i, R * (d.value / 100) * t);
        return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--color-primary)" />;
      })}
      {/* 標籤 */}
      {data.map((d, i) => {
        const [x, y] = point(i, R + 26);
        const a = angle(i);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-foreground"
            fontSize={12}
            fontWeight={600}
          >
            <tspan>{d.axis.length > 6 ? d.axis.slice(0, 6) + "…" : d.axis}</tspan>
            <tspan x={x} dy={14} className="fill-muted-foreground" fontSize={11} fontWeight={400}>
              {d.value}%
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
