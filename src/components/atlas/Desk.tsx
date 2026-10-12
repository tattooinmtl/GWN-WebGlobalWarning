import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BarChart3, CloudRain, Globe, Map as MapIcon, Minus, Pause, Pin, Play, X } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { weatherText } from "@/lib/disasters/format";
import { openSourcesPage } from "@/lib/desk/sources";
import { frameLoaded, recoloredTiles, registerRadarProtocol, setFrameLayers, showFrame } from "@/lib/atlas/radar-frames";
import { useDesk } from "@/lib/desk/store";
import type { DeskWindow } from "@/lib/desk/types";

type Radar = { host: string; frames: { time: number; path: string }[] } | null;
type Noaa = { times: string[] } | null;

type Props = {
  radar: Radar;
  noaa: Noaa;
  cloudTime: string | null;
};

const NOAA_WMS = "https://nowcoast.noaa.gov/geoserver/observations/weather_radar/wms";
// Extent of conus_base_reflectivity_mosaic in the service capabilities (covers southern Canada too).
const NOAA_BOX = { west: -130, east: -60, south: 20, north: 55 };

type RainFrame = { id: string; time: number; tiles: string };
type RainSet = { label: string; attribution: string; maxzoom: number; frames: RainFrame[] };

// NOAA MRMS (1 km, ~4 min) inside its coverage, RainViewer (worldwide) everywhere else.
function rainSet(radar: Radar, noaa: Noaa, lat: number | null, lon: number | null): RainSet {
  const inNoaa =
    lat != null && lon != null && lon >= NOAA_BOX.west && lon <= NOAA_BOX.east && lat >= NOAA_BOX.south && lat <= NOAA_BOX.north;
  if (inNoaa && noaa?.times.length) {
    return {
      label: "NOAA",
      attribution: "Radar © NOAA/NWS MRMS",
      maxzoom: 10,
      frames: noaa.times.map((time) => ({
        id: time,
        time: Date.parse(time),
        tiles: recoloredTiles(
          "noaa",
          `${NOAA_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=conus_base_reflectivity_mosaic&styles=&format=image/png&transparent=true&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}&time=${encodeURIComponent(time)}`,
        ),
      })),
    };
  }
  if (radar?.frames.length) {
    return {
      label: "RainViewer",
      attribution: "Radar © RainViewer",
      maxzoom: 7,
      frames: radar.frames.map((frame) => ({
        id: frame.path,
        time: frame.time * 1000,
        tiles: recoloredTiles("rainviewer", `${radar.host}${frame.path}/256/{z}/{x}/{y}/2/0_1.png`),
      })),
    };
  }
  return { label: "", attribution: "", maxzoom: 7, frames: [] };
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function cloudTiles(lon: number | null, time: string | null): string | null {
  if (!time) return null;
  const layer = lon != null && lon < -100 ? "GOES-West_ABI_GeoColor" : "GOES-East_ABI_GeoColor";
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.jpg`;
}

function circle(lon: number, lat: number, km: number): number[][] {
  const ring: number[][] = [];
  for (let i = 0; i <= 64; i++) {
    const bearing = (i / 64) * Math.PI * 2;
    const lat2 = lat + (km / 110.574) * Math.cos(bearing);
    const lon2 = lon + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(bearing);
    ring.push([lon2, lat2]);
  }
  return ring;
}

function drag(start: { x: number; y: number }, onMove: (x: number, y: number) => void) {
  return (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const ox = event.clientX;
    const oy = event.clientY;
    const move = (ev: PointerEvent) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      onMove(
        Math.min(width - 48, Math.max(8, start.x + ev.clientX - ox)),
        Math.min(height - 48, Math.max(64, start.y + ev.clientY - oy)),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

function MapPane({ item, rain, cloudTime }: { item: DeskWindow; rain: RainSet; cloudTime: string | null }) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const cloudOn = useRef(item.showClouds);
  const cloudRef = useRef(cloudTiles(item.lon, cloudTime));
  const [broken, setBroken] = useState("");
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(-1);
  const [, setTilesTick] = useState(0);
  const [playing, setPlaying] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  cloudOn.current = item.showClouds;
  cloudRef.current = cloudTiles(item.lon, cloudTime);
  const frames = item.showRain ? rain.frames : [];
  const framesKey = frames.map((frame) => frame.id).join("|");
  const current = frames.length ? (index < 0 || index >= frames.length ? frames.length - 1 : index) : -1;

  useEffect(() => {
    const host = node.current;
    if (!host) return;
    let dead = false;
    let map: import("maplibre-gl").Map | null = null;
    let watch: ResizeObserver | null = null;
    void (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        const workerMod = await import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url");
        if (dead || !node.current) return;
        maplibregl.setWorkerUrl(workerMod.default);
        registerRadarProtocol(maplibregl);
        const lat = item.lat ?? 20;
        const lon = item.lon ?? 0;
        map = new maplibregl.Map({
          container: node.current,
          center: [lon, lat],
          zoom: 8,
          attributionControl: false,
          style: {
            version: 8,
            // Free OpenStreetMap tiles only (no API key, attribution only). Do not use paid/keyed tile hosts.
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                maxzoom: 19,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [
              { id: "bg", type: "background", paint: { "background-color": "#101820" } },
              { id: "osm", type: "raster", source: "osm", paint: { "raster-brightness-max": 0.85, "raster-saturation": -0.2 } },
            ],
          },
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
        map.on("error", (event) => {
          const source = (event as { sourceId?: string }).sourceId;
          if (source === "osm" && !dead) setBroken("Map tiles could not load. Check your connection or ad blocker.");
        });
        watch = new ResizeObserver(() => map?.resize());
        watch.observe(node.current);
        map.on("load", () => {
          if (!map) return;
          if (item.lat != null && item.lon != null && item.radiusKm) {
            const ring = circle(item.lon, item.lat, item.radiusKm);
            map.addSource("ring", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } },
            });
            map.addLayer({
              id: "ring-fill",
              type: "fill",
              source: "ring",
              paint: { "fill-color": "#3ec6ff", "fill-opacity": 0.08 },
            });
            map.addLayer({
              id: "ring-line",
              type: "line",
              source: "ring",
              paint: { "line-color": "#3ec6ff", "line-width": 1.5 },
            });
            const lons = ring.map((point) => point[0]);
            const lats = ring.map((point) => point[1]);
            map.fitBounds(
              [
                [Math.min(...lons), Math.min(...lats)],
                [Math.max(...lons), Math.max(...lats)],
              ],
              { padding: 24, animate: false },
            );
          }
          map.resize();
          syncRaster(map, "clouds", cloudOn.current ? cloudRef.current : null, cloudOn.current, 7);
          setReady(true);
        });
        // Re-render as radar frames finish loading so playback and the "loading" label stay current.
        map.on("sourcedata", (event) => {
          if (event.sourceId?.startsWith("rain-") && event.isSourceLoaded) setTilesTick((tick) => tick + 1);
        });
        mapRef.current = map;
      } catch (err) {
        if (!dead) setBroken(err instanceof Error ? err.message : "Map failed to start");
      }
    })();
    return () => {
      dead = true;
      setReady(false);
      watch?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [item.id, item.lat, item.lon, item.radiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncRaster(map, "clouds", item.showClouds ? cloudTiles(item.lon, cloudTime) : null, item.showClouds, 7);
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setFrameLayers(
      map,
      "rain-",
      frames.map((frame) => frame.tiles),
      { maxzoom: rain.maxzoom, attribution: rain.attribution },
    );
    setIndex(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, framesKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) showFrame(map, "rain-", frames.length, current, 0.75);
  }, [ready, framesKey, frames.length, current]);

  // Only step onto a frame whose tiles are in, so the loop never flashes an empty frame while buffering.
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((at) => {
        const from = at < 0 ? frames.length - 1 : at;
        const next = (from + 1) % frames.length;
        return frameLoaded(mapRef.current, "rain-", next) ? next : from;
      });
    }, 800);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  return (
    <div className="relative h-full w-full" style={{ height: "100%", width: "100%", minHeight: 220 }}>
      <div ref={node} className="h-full w-full" style={{ height: "100%", width: "100%" }} />
      {broken ? <p className="absolute inset-x-3 top-10 z-10 rounded-lg bg-panel/90 px-2 py-1 text-sm text-cream">{broken}</p> : null}
      {current >= 0 ? (
        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-full border border-line bg-panel/90 py-1 pl-1 pr-3">
          <button
            type="button"
            className="grid size-7 shrink-0 place-items-center rounded-full bg-panel-2"
            aria-label={playing ? "Pause radar" : "Play radar"}
            onClick={() => setPlaying((on) => !on)}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            step={1}
            value={current}
            aria-label="Radar time"
            className="min-w-0 flex-1 accent-[#3ec6ff]"
            onChange={(event) => {
              setPlaying(false);
              setIndex(Number(event.target.value));
            }}
          />
          <span className="shrink-0 text-xs tabular-nums text-cream">
            {rain.label} {clock(frames[current].time)}
            {frameLoaded(mapRef.current, "rain-", current) ? "" : " · loading…"}
          </span>
        </div>
      ) : item.showRain && ready ? (
        <p className="absolute inset-x-2 bottom-2 z-10 rounded-full bg-panel/90 px-3 py-1 text-xs text-muted">
          No radar frames loaded yet.
        </p>
      ) : null}
    </div>
  );
}

function syncRaster(map: import("maplibre-gl").Map, id: string, tiles: string | null, visible: boolean, maxzoom = 12) {
  if (!map.getSource(id) && tiles) {
    map.addSource(id, { type: "raster", tiles: [tiles], tileSize: 256, maxzoom });
    // Keep clouds under the radar frames.
    map.addLayer(
      { id, type: "raster", source: id, paint: { "raster-opacity": id === "clouds" ? 0.72 : 0.7 } },
      map.getLayer("rain-0") ? "rain-0" : undefined,
    );
  }
  const source = map.getSource(id) as { setTiles?: (tiles: string[]) => void } | undefined;
  if (source?.setTiles && tiles) source.setTiles([tiles]);
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible && tiles ? "visible" : "none");
}

function ChartPane({ item }: { item: DeskWindow }) {
  const max = Math.max(...item.bars.map((bar) => bar.value), 1);
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-3">
      <p className="text-xs text-muted">{item.summary}</p>
      <svg viewBox={`0 0 320 ${item.bars.length * 28 + 8}`} className="w-full" role="img" aria-label={item.title}>
        {item.bars.map((bar, index) => {
          const width = Math.max(2, (bar.value / max) * 210);
          const y = 8 + index * 28;
          return (
            <g key={bar.label}>
              <text x="0" y={y + 12} fill="#e8eef6" fontSize="11">
                {bar.label.slice(0, 16)}
              </text>
              <rect x="104" y={y} width={width} height="16" rx="4" fill="#f5c518" />
              <text x={110 + width} y={y + 12} fill="#8ea0b3" fontSize="11">
                {Math.round(bar.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function WebPane({ item }: { item: DeskWindow }) {
  return (
    <article className="h-full overflow-auto bg-panel-2 px-4 py-3 text-sm">
      <p className="text-xs tracking-wide text-amber">Page</p>
      <h3 className="mt-1 font-display text-2xl leading-none">{item.title}</h3>
      <p className="mt-3 whitespace-pre-wrap">{item.summary || "Sorry no info could be retrieved from web search."}</p>
      {item.pageUrl ? (
        <a href={item.pageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-cyan hover:underline">
          Open the full page
        </a>
      ) : null}
    </article>
  );
}

function WindowCard({ item, radar, noaa, cloudTime }: { item: DeskWindow; radar: Radar; noaa: Noaa; cloudTime: string | null }) {
  const focus = useDesk((s) => s.focus);
  const close = useDesk((s) => s.close);
  const minimize = useDesk((s) => s.minimize);
  const togglePin = useDesk((s) => s.togglePin);
  const move = useDesk((s) => s.move);
  const weather = item.weather
    ? `${weatherText(item.weather.code)}${item.weather.tempC != null ? ` · ${Math.round(item.weather.tempC)}°C` : ""}${item.weather.rain != null ? ` · rain ${item.weather.rain} mm` : ""}`
    : null;

  return (
    <section
      className="pointer-events-auto absolute flex w-[min(440px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel/95 shadow-2xl backdrop-blur-md"
      style={{ left: item.x, top: item.y, zIndex: 10 + item.z, height: 420 }}
      onPointerDown={() => focus(item.id)}
    >
      <header
        className="flex cursor-grab items-center gap-2 border-b border-line px-2 py-2 active:cursor-grabbing"
        onPointerDown={drag({ x: item.x, y: item.y }, (x, y) => move(item.id, x, y))}
      >
        <p className="min-w-0 flex-1 truncate font-display text-lg leading-none tracking-wide">{item.title}</p>
        <button type="button" className="icon-btn" aria-label={item.pinned ? "Unpin window" : "Pin window"} onClick={() => togglePin(item.id)}>
          <Pin className={item.pinned ? "size-4 text-amber" : "size-4"} />
        </button>
        <button type="button" className="icon-btn" aria-label="Minimize window" onClick={() => minimize(item.id)}>
          <Minus className="size-4" />
        </button>
        <button type="button" className="icon-btn" aria-label="Close window" onClick={() => close(item.id)}>
          <X className="size-4" />
        </button>
      </header>
      <div className="relative min-h-0 flex-1 bg-[#101820]" style={{ height: 260 }}>
        {item.kind === "chart" ? <ChartPane item={item} /> : null}
        {item.kind === "web" ? <WebPane item={item} /> : null}
        {item.kind === "radar" || item.kind === "place" ? <MapPane item={item} rain={rainSet(radar, noaa, item.lat, item.lon)} cloudTime={cloudTime} /> : null}
        {item.kind === "radar" || item.kind === "place" ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {item.weather?.tempC != null ? <span className="rounded-full bg-panel/90 px-2 py-0.5 text-xs">{Math.round(item.weather.tempC)}°C</span> : null}
            {item.weather ? <span className="rounded-full bg-panel/90 px-2 py-0.5 text-xs">{weatherText(item.weather.code)}</span> : null}
            {item.weather?.rain != null ? <span className="rounded-full bg-panel/90 px-2 py-0.5 text-xs">Rain {item.weather.rain} mm</span> : null}
            {item.weather?.wind != null ? <span className="rounded-full bg-panel/90 px-2 py-0.5 text-xs">Wind {Math.round(item.weather.wind)} km/h</span> : null}
            {item.lat != null && item.lon != null ? (
              <span className="rounded-full bg-panel/90 px-2 py-0.5 text-xs">
                {item.lat.toFixed(2)}, {item.lon.toFixed(2)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <footer className="flex items-center justify-between gap-2 border-t border-line px-2 py-1.5">
        <p className="truncate text-xs text-muted">
          {item.radiusKm ? `${item.radiusKm} km · ` : ""}
          {weather || item.summary}
        </p>
        <button type="button" className="chip shrink-0" onClick={() => openSourcesPage(item.title, item.sources)}>
          Web sources
        </button>
      </footer>
    </section>
  );
}

const KIND_ICON = {
  radar: CloudRain,
  place: MapIcon,
  chart: BarChart3,
  web: Globe,
} as const;

export function Desk({ radar, noaa, cloudTime }: Props) {
  const windows = useDesk((s) => s.windows);
  const widget = useDesk((s) => s.widget);
  const moveWidget = useDesk((s) => s.moveWidget);
  const restore = useDesk((s) => s.restore);
  const focus = useDesk((s) => s.focus);
  const close = useDesk((s) => s.close);

  useEffect(() => {
    void Promise.resolve(useDesk.persist.rehydrate());
  }, []);

  if (windows.length === 0) return null;
  const open = windows.filter((item) => !item.minimized);
  const minimized = windows.filter((item) => item.minimized);

  return (
    <div className="pointer-events-none absolute inset-0">
      {open.map((item) => (
        <WindowCard key={item.id} item={item} radar={radar} noaa={noaa} cloudTime={cloudTime} />
      ))}

      <div
        className="pointer-events-auto absolute flex items-center gap-1 rounded-full border border-line bg-panel/95 p-1 shadow-lg"
        style={{ left: widget.x, top: widget.y, zIndex: 80 }}
      >
        <button
          type="button"
          className="relative grid size-9 cursor-grab place-items-center rounded-full bg-panel-2 active:cursor-grabbing"
          aria-label="Move window tray"
          onPointerDown={drag(widget, moveWidget)}
        >
          <span className="font-display text-sm">G</span>
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-amber text-[10px] font-semibold text-bg">
            {windows.length}
          </span>
        </button>
        {windows.map((item, index) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <button
              key={item.id}
              type="button"
              className="relative grid size-9 place-items-center rounded-full border border-line"
              title={item.title}
              aria-label={item.title}
              onClick={() => (item.minimized ? restore(item.id) : focus(item.id))}
            >
              <Icon className="size-4" />
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-panel-2 text-[10px] text-cream">
                {index + 1}
              </span>
              {item.pinned ? <span className="absolute bottom-0.5 size-1.5 rounded-full bg-amber" /> : null}
            </button>
          );
        })}
      </div>

      {minimized.length > 0 ? (
        <div className="pointer-events-auto absolute bottom-3 right-3 z-[70] flex max-w-[calc(100vw-1.5rem)] gap-2 overflow-x-auto lg:right-[22rem]">
          {minimized.map((item) => (
            <div key={item.id} className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-panel/95 py-1 pl-3 pr-1">
              <button type="button" className="max-w-40 truncate text-sm" onClick={() => restore(item.id)}>
                {item.title}
              </button>
              <button type="button" className="icon-btn" aria-label={`Close ${item.title}`} onClick={() => close(item.id)}>
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
