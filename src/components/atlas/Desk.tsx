import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { BarChart3, CloudRain, Globe, Map as MapIcon, Minus, Pin, X } from "lucide-react";
import { weatherText } from "@/lib/disasters/format";
import { openSourcesPage } from "@/lib/desk/sources";
import { useDesk } from "@/lib/desk/store";
import type { DeskWindow } from "@/lib/desk/types";

type Radar = { host: string; frames: { path: string }[] } | null;

type Props = {
  radar: Radar;
  frame: number;
};

function rainTiles(radar: Radar, frame: number): string | null {
  if (!radar?.frames.length) return null;
  const path = radar.frames[frame % radar.frames.length]?.path;
  if (!path) return null;
  return `${radar.host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

function cloudTiles(lon: number | null): string {
  const day = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const layer = lon != null && lon < -100 ? "GOES-West_ABI_GeoColor" : "GOES-East_ABI_GeoColor";
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${day}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.jpg`;
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

function MapPane({
  item,
  radarUrl,
}: {
  item: DeskWindow;
  radarUrl: string | null;
}) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const rainRef = useRef(radarUrl);
  const rainOn = useRef(item.showRain);
  const cloudOn = useRef(item.showClouds);
  rainRef.current = radarUrl;
  rainOn.current = item.showRain;
  cloudOn.current = item.showClouds;

  useEffect(() => {
    const host = node.current;
    if (!host) return;
    let dead = false;
    let map: import("maplibre-gl").Map | null = null;
    void (async () => {
      const maplibregl = await import("maplibre-gl");
      const workerMod = await import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url");
      if (dead || !node.current) return;
      maplibregl.setWorkerUrl(workerMod.default);
      const lat = item.lat ?? 20;
      const lon = item.lon ?? 0;
      map = new maplibregl.Map({
        container: node.current,
        center: [lon, lat],
        zoom: item.radiusKm ? 7 : 1.7,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap © CARTO",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
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
            { padding: 18, animate: false },
          );
        }
        map.resize();
        syncRaster(map, "rain", rainRef.current, rainOn.current);
        syncRaster(map, "clouds", cloudOn.current ? cloudTiles(item.lon) : null, cloudOn.current);
      });
      mapRef.current = map;
    })();
    return () => {
      dead = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [item.id, item.lat, item.lon, item.radiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncRaster(map, "rain", radarUrl, item.showRain);
    syncRaster(map, "clouds", item.showClouds ? cloudTiles(item.lon) : null, item.showClouds);
  });

  return <div ref={node} className="absolute inset-0" />;
}

function syncRaster(map: import("maplibre-gl").Map, id: string, tiles: string | null, visible: boolean) {
  if (!map.getSource(id) && tiles) {
    map.addSource(id, { type: "raster", tiles: [tiles], tileSize: 256 });
    map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": id === "clouds" ? 0.72 : 0.62 } });
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

function WindowCard({ item, radarUrl }: { item: DeskWindow; radarUrl: string | null }) {
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
      style={{ left: item.x, top: item.y, zIndex: 10 + item.z, height: 360 }}
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
      <div className="relative min-h-0 flex-1 bg-bg">
        {item.kind === "chart" ? <ChartPane item={item} /> : null}
        {item.kind === "web" ? <WebPane item={item} /> : null}
        {item.kind === "radar" || item.kind === "place" ? <MapPane item={item} radarUrl={radarUrl} /> : null}
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

export function Desk({ radar, frame }: Props) {
  const windows = useDesk((s) => s.windows);
  const widget = useDesk((s) => s.widget);
  const moveWidget = useDesk((s) => s.moveWidget);
  const restore = useDesk((s) => s.restore);
  const focus = useDesk((s) => s.focus);
  const close = useDesk((s) => s.close);
  const radarUrl = rainTiles(radar, frame);

  useEffect(() => {
    void Promise.resolve(useDesk.persist.rehydrate());
  }, []);

  if (windows.length === 0) return null;
  const open = windows.filter((item) => !item.minimized);
  const minimized = windows.filter((item) => item.minimized);

  return (
    <div className="pointer-events-none absolute inset-0">
      {open.map((item) => (
        <WindowCard key={item.id} item={item} radarUrl={radarUrl} />
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
