import type { Map as MlMap } from "maplibre-gl";

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
