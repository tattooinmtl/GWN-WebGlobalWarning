import { createServerFn } from "@tanstack/react-start";
import { CMAPS, LAYER_BY_ID, type LayerSettings } from "./layers";
import type { LegendInfo, PointReport } from "./types";

function cleanSettings(input: Partial<LayerSettings> | undefined): LayerSettings {
  const lo = Number(input?.range?.[0]);
  const hi = Number(input?.range?.[1]);
  const cmap = String(input?.cmap ?? "thermal");
  return {
    on: true,
    opacity: 1,
    cmap: (CMAPS as readonly string[]).includes(cmap) ? cmap : "thermal",
    range: [Number.isFinite(lo) ? lo : 0, Number.isFinite(hi) ? hi : 1],
    onlyInRange: Boolean(input?.onlyInRange),
    arrows: Boolean(input?.arrows),
  };
}

export const cmemsLegend = createServerFn({ method: "POST" })
  .validator((input: { layerId: string; settings: Partial<LayerSettings> }) => {
    const layerId = String(input?.layerId ?? "");
    if (!LAYER_BY_ID.has(layerId)) throw new Error("Unknown layer");
    return { layerId, settings: cleanSettings(input?.settings) };
  })
  .handler(async ({ data }): Promise<LegendInfo> => {
    const { loadLegend } = await import("./data.server");
    return loadLegend(data.layerId, data.settings);
  });

export const cmemsPoint = createServerFn({ method: "POST" })
  .validator((input: { lat: number; lon: number; layers: string[]; depth?: number }) => {
    const lat = Number(input?.lat);
    const lon = Number(input?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new Error("Bad coordinates");
    }
    const layers = (Array.isArray(input?.layers) ? input.layers : []).map(String).filter((id) => LAYER_BY_ID.has(id)).slice(0, 16);
    const depth = Number(input?.depth);
    return { lat, lon, layers, depth: Number.isFinite(depth) && depth >= 0 ? depth : 0.494025 };
  })
  .handler(async ({ data }): Promise<PointReport> => {
    const { loadPoint } = await import("./data.server");
    return loadPoint(data.lat, data.lon, data.layers, data.depth);
  });
