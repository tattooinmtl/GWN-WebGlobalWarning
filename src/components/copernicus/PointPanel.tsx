import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatValue, LAYER_BY_ID } from "@/lib/copernicus/layers";
import type { PointReport, SeriesPoint } from "@/lib/copernicus/types";

const AXIS = { stroke: "#8ea0b3", fontSize: 10 };
const TIP = {
  contentStyle: { background: "#101820", border: "1px solid #2c3e50", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "#e8eef6" },
};

const dayLabel = (t: string) => new Date(t.length === 10 ? `${t}T00:00:00Z` : `${t}Z`).toUTCString().slice(0, 3);
const hourLabel = (t: string) => `${dayLabel(t)} ${t.slice(11, 13)}h`;

export function PointPanel({ report, loading, error, day }: { report?: PointReport; loading: boolean; error: string | null; day: string }) {
  if (loading) return <p className="p-4 text-sm text-muted">Reading Copernicus data for this spot…</p>;
  if (error) return <p className="p-4 text-sm text-crimson">{error}</p>;
  if (!report) return <p className="p-4 text-sm text-muted">Click anywhere on the map to see values and charts for that spot.</p>;

  const rainTotal = report.rain?.daily.reduce((sum, p) => sum + (p.v ?? 0), 0) ?? 0;
  const next24 = report.rain?.bins.slice(0, 8).reduce((sum, p) => sum + (p.v ?? 0), 0) ?? 0;
  const values = report.ocean.filter((row) => LAYER_BY_ID.has(row.id));

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-xs text-muted">
        {report.lat.toFixed(2)}°, {report.lon.toFixed(2)}° · values for {report.day} UTC
      </p>

      {values.length ? (
        <Card title="Ocean right here">
          <dl className="grid grid-cols-2 gap-2">
            {values.map((row) => {
              const layer = LAYER_BY_ID.get(row.id)!;
              return (
                <div key={row.id} className="rounded-md bg-bg/70 px-2 py-1.5">
                  <dt className="text-[11px] text-muted">{layer.label}</dt>
                  <dd className="font-display text-xl leading-tight">{row.value === null ? "—" : formatValue(layer, row.value)}</dd>
                </div>
              );
            })}
          </dl>
          {values.every((row) => row.value === null) && !report.errors.length ? <p className="mt-2 text-xs text-muted">No sea data here (land or outside coverage).</p> : null}
        </Card>
      ) : null}

      {report.rain ? (
        <Card title="Rain (mm) — ECMWF forecast">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Stat label="Next 24 h" value={`${next24.toFixed(1)} mm`} />
            <Stat label="Next 7 days" value={`${rainTotal.toFixed(1)} mm`} />
          </div>
          <Chart>
            <BarChart data={report.rain.bins}>
              <CartesianGrid stroke="#2c3e50" vertical={false} />
              <XAxis dataKey="t" tickFormatter={dayLabel} interval={7} tick={AXIS} />
              <YAxis width={28} tick={AXIS} />
              <Tooltip {...TIP} labelFormatter={(t) => hourLabel(String(t))} formatter={(v) => [`${Number(v).toFixed(1)} mm`, "3 h"]} />
              <Bar dataKey="v" fill="#3ec6ff" radius={[2, 2, 0, 0]} />
            </BarChart>
          </Chart>
          <div className="mt-2 flex flex-wrap gap-1">
            {report.rain.daily.map((p, i) => {
              const snow = report.rain?.snowDaily[i]?.v ?? 0;
              return (
                <span key={p.t} className="rounded-sm bg-bg/70 px-1.5 py-0.5 text-[11px]">
                  {dayLabel(p.t)} <b>{(p.v ?? 0).toFixed(1)}</b> mm{snow > 0 ? ` · ❄ ${snow.toFixed(1)} cm` : ""}
                </span>
              );
            })}
          </div>
        </Card>
      ) : null}

      {report.sst.length ? (
        <Card title="Sea temperature (°C) — 11 days">
          <LineSeries data={report.sst} color="#ff8a2a" unit="°C" day={day} />
        </Card>
      ) : null}

      {report.waves.length ? (
        <Card title="Wave height (m) — 11 days">
          <LineSeries data={report.waves} color="#3ec6ff" unit="m" day={day} />
        </Card>
      ) : null}

      {report.air ? (
        <Card title="Air quality — Copernicus CAMS">
          <div className="mb-2 grid grid-cols-3 gap-2">
            <Stat label="PM2.5 now" value={`${latest(report.air.pm25)} µg/m³`} />
            <Stat label="Ozone now" value={`${latest(report.air.ozone)} µg/m³`} />
            <Stat label="UV max" value={max(report.air.uv)} />
          </div>
          <Chart>
            <LineChart data={report.air.pm25.map((p, i) => ({ t: p.t, pm: p.v, o3: report.air!.ozone[i]?.v ?? null, dust: report.air!.dust[i]?.v ?? null }))}>
              <CartesianGrid stroke="#2c3e50" vertical={false} />
              <XAxis dataKey="t" tickFormatter={dayLabel} interval={7} tick={AXIS} />
              <YAxis width={28} tick={AXIS} />
              <Tooltip {...TIP} labelFormatter={(t) => hourLabel(String(t))} />
              <Line dataKey="pm" name="PM2.5" stroke="#f5c518" dot={false} strokeWidth={2} />
              <Line dataKey="o3" name="Ozone" stroke="#2dd4bf" dot={false} strokeWidth={2} />
              <Line dataKey="dust" name="Dust" stroke="#c4a574" dot={false} strokeWidth={1.5} />
            </LineChart>
          </Chart>
          <p className="mt-1 text-[11px] text-muted">
            <span className="text-amber">■</span> PM2.5 <span className="ml-2 text-storm">■</span> Ozone <span className="ml-2 text-drought">■</span> Dust (µg/m³)
          </p>
        </Card>
      ) : null}

      {report.river ? (
        <Card title="River flow (m³/s) — Copernicus GloFAS">
          <Chart>
            <LineChart data={report.river.discharge.map((p, i) => ({ t: p.t, flow: p.v, max: report.river!.max[i]?.v ?? null }))}>
              <CartesianGrid stroke="#2c3e50" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(t) => String(t).slice(5)} interval={6} tick={AXIS} />
              <YAxis width={44} tick={AXIS} />
              <Tooltip {...TIP} />
              <ReferenceLine x={report.day} stroke="#e8eef6" strokeDasharray="3 3" />
              <Line dataKey="flow" name="Expected flow" stroke="#3ec6ff" dot={false} strokeWidth={2} />
              <Line dataKey="max" name="Worst case" stroke="#e23b4a" dot={false} strokeDasharray="4 3" />
            </LineChart>
          </Chart>
          <p className="mt-1 text-[11px] text-muted">Nearest river cell · blue expected, red dashed worst ensemble member.</p>
        </Card>
      ) : null}

      {report.errors.length ? <p className="text-[11px] text-muted">Unavailable: {report.errors.join(" · ")}</p> : null}
    </div>
  );
}

function LineSeries({ data, color, unit, day }: { data: SeriesPoint[]; color: string; unit: string; day: string }) {
  return (
    <Chart>
      <LineChart data={data}>
        <CartesianGrid stroke="#2c3e50" vertical={false} />
        <XAxis dataKey="t" tickFormatter={(t) => String(t).slice(5)} interval={1} tick={AXIS} />
        <YAxis width={32} tick={AXIS} domain={["auto", "auto"]} />
        <Tooltip {...TIP} formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`, ""]} />
        <ReferenceLine x={day} stroke="#f5c518" strokeDasharray="3 3" />
        <Line dataKey="v" stroke={color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </LineChart>
    </Chart>
  );
}

function Chart({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cm-tile p-3">
      <h3 className="mb-2 font-display text-base uppercase leading-none tracking-wider text-amber">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-bg/70 px-2 py-1.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-display text-lg leading-tight">{value}</p>
    </div>
  );
}

function latest(points: SeriesPoint[]): string {
  const now = new Date().toISOString().slice(0, 13);
  const hit = points.filter((p) => p.t.slice(0, 13) <= now && p.v !== null).at(-1);
  return hit?.v === undefined || hit.v === null ? "—" : hit.v.toFixed(0);
}

function max(points: SeriesPoint[]): string {
  const values = points.map((p) => p.v).filter((v): v is number => v !== null);
  return values.length ? Math.max(...values).toFixed(1) : "—";
}
