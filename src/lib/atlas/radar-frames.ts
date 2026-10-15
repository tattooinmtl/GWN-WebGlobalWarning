import type { Map as MlMap } from "maplibre-gl";
import { recolorImage, type RadarSource } from "./weather-colors";

/**
 * Animated radar as one preloaded raster layer per frame (`${prefix}0`, `${prefix}1`, …).
 * Playback only flips opacity, so a loop downloads each frame's tiles once.
 *
 * Swapping a single source's tiles every frame instead re-requested the whole viewport on every
 * step. MapLibre's image queue is shared by every map on the page (16 parallel requests), so on
 * big screens that flood starved the other maps' radar until a full loop was in the HTTP cache.
 */
export function setFrameLayers(
  map: MlMap,
  prefix: string,
  tiles: string[],
  options: { maxzoom: number; attribution: string; beforeId?: string; tileSize?: number },
) {
  clearFrameLayers(map, prefix);
  const beforeId = options.beforeId && map.getLayer(options.beforeId) ? options.beforeId : undefined;
  tiles.forEach((url, i) => {
    const id = `${prefix}${i}`;
    map.addSource(id, {
      type: "raster",
      tiles: [url],
      tileSize: options.tileSize ?? 256,
      maxzoom: options.maxzoom,
      attribution: i === 0 ? options.attribution : undefined,
    });
    map.addLayer(
      {
        id,
        type: "raster",
        source: id,
        paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 0 }, "raster-fade-duration": 0 },
      },
      beforeId,
    );
  });
}

export function clearFrameLayers(map: MlMap, prefix: string) {
  for (const layer of map.getStyle().layers) {
    if (!layer.id.startsWith(prefix)) continue;
    map.removeLayer(layer.id);
    if (map.getSource(layer.id)) map.removeSource(layer.id);
  }
}

export function showFrame(map: MlMap, prefix: string, count: number, index: number, opacity: number) {
  for (let i = 0; i < count; i++) {
    const id = `${prefix}${i}`;
    if (map.getLayer(id)) map.setPaintProperty(id, "raster-opacity", i === index ? opacity : 0);
  }
}

export function frameLoaded(map: MlMap | null, prefix: string, index: number): boolean {
  try {
    return Boolean(map?.getSource(`${prefix}${index}`) && map.isSourceLoaded(`${prefix}${index}`));
  } catch {
    return false;
  }
}

export const RADAR_PROTOCOL = "gwnradar";

/** Route a radar tile template through the recoloring protocol (see weather-colors.ts). */
export function recoloredTiles(source: RadarSource, url: string): string {
  return `${RADAR_PROTOCOL}://${source}/${url}`;
}

let protocolReady = false;
// Identical tile URLs requested at the same time (world copies, frame rebuilds) share one download.
const inflight = new Map<string, Promise<ImageData>>();

async function loadRecolored(source: RadarSource, url: string): Promise<ImageData> {
  // Hard cap so a stalled download can never hold one of MapLibre's 16 shared image slots forever.
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Radar tile HTTP ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Radar recolor needs a 2D canvas");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  recolorImage(source, image.data);
  return image;
}

function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    work.then(resolve, reject);
  });
}

/** Fetch each radar tile, repaint its pixels with the app palette, hand MapLibre the bitmap. */
export function registerRadarProtocol(lib: typeof import("maplibre-gl")) {
  if (protocolReady) return;
  protocolReady = true;
  lib.addProtocol(RADAR_PROTOCOL, async (params, abortController) => {
    const rest = params.url.slice(`${RADAR_PROTOCOL}://`.length);
    const slash = rest.indexOf("/");
    const source = rest.slice(0, slash) as RadarSource;
    const url = rest.slice(slash + 1);
    let work = inflight.get(params.url);
    if (!work) {
      work = loadRecolored(source, url).finally(() => inflight.delete(params.url));
      inflight.set(params.url, work);
    }
    const image = await untilAborted(work, abortController.signal);
    return { data: await createImageBitmap(image) };
  });
}
