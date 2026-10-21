import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Globe2, Layers, Minus, Moon, Plus, Sun, Waves, X } from "lucide-react";
import { loadAtlas } from "@/lib/disasters/api";
import { DEPTHS, LAYER_BY_ID, dayStamp, defaultSettings, tileTemplate } from "@/lib/copernicus/layers";
import { formatLatLon, type SkyState } from "@/lib/globe/astro";
import {
  LEVELS,
  LEVEL_STYLE,
  TYPE_EMOJI,
  WINDOWS,
  fromDisaster,
  quakeLevel,
  parseXMarkers,
  type GlobeMarker,
  type WarnLevel,
  type WindowId,
} from "@/lib/globe/events";
import type { GlobeEngine, LayerState, QuakePoint } from "./engine";

/** Static markers written by the daily X scan (schema: public/data/X-MARKERS.md). */
export const X_MARKERS_URL = "/data/x-markers.json";
const USGS_HOUR = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
const USGS_MONTH = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson";

type Toggles = {
  clouds: boolean;
  precip: boolean;
  quakeHeat: boolean;
  faultsActive: boolean;
  faultsDormant: boolean;
  s2: boolean;
  sst: boolean;
  live: boolean;
  x: boolean;
  night: boolean;
  moon: boolean;
};

const DEFAULT_TOGGLES: Toggles = {
  clouds: true,
  precip: false,
  quakeHeat: false,
  faultsActive: true,
  faultsDormant: false,
  s2: false,
  sst: false,
  live: true,
  x: true,
  night: true,
  moon: true,
};

export function GlobeApp() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <GlobeInner />
    </QueryClientProvider>
  );
}

function GlobeInner() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES);
  const [states, setStates] = useState<Record<string, { state: LayerState; note?: string }>>({});
  const [sky, setSky] = useState<SkyState | null>(null);
  const [picked, setPicked] = useState<GlobeMarker | null>(null);
  const [windowId, setWindowId] = useState<WindowId>("1h");
  const [minLevel, setMinLevel] = useState<WarnLevel>("green");
  const [panelOpen, setPanelOpen] = useState(true);
  // 0 until mounted so the server render and the first client render match (no hydration mismatch).
  const [now, setNow] = useState(0);
  const [autoWidened, setAutoWidened] = useState(false);

  // Live feeds (server function already used by the main page: USGS, Earthquakes Canada, EONET, GDACS, NWS, ECCC,
  // CWFIS, Smithsonian, RainViewer).
  const atlas = useQuery({
    queryKey: ["globe-atlas"],
    queryFn: () => loadAtlas({ data: { nasaKey: "" } }),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const xMarkers = useQuery({
    queryKey: ["globe-x-markers"],
    queryFn: async () => {
      const res = await fetch(`${X_MARKERS_URL}?t=${Math.floor(Date.now() / 300_000)}`);
      if (!res.ok) return [];
      return parseXMarkers(await res.json());
    },
    refetchInterval: 300_000,
  });
  const quakes = useQuery({
    queryKey: ["globe-usgs-month"],
    queryFn: async (): Promise<QuakePoint[]> => {
      const res = await fetch(USGS_MONTH);
      const json = (await res.json()) as { features: { geometry: { coordinates: number[] }; properties: { mag: number | null } }[] };
      return json.features
        .filter((f) => f.geometry && f.properties.mag != null)
        .map((f) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], mag: f.properties.mag ?? 0 }));
    },
    enabled: toggles.quakeHeat,
    staleTime: 600_000,
  });

  // USGS "all quakes, past hour" (every magnitude) — the densest true last-hour source.
  const hourQuakes = useQuery({
    queryKey: ["globe-usgs-hour"],
    queryFn: async (): Promise<GlobeMarker[]> => {
      const res = await fetch(USGS_HOUR);
      const json = (await res.json()) as {
        features: {
          id: string;
          geometry: { coordinates: number[] };
          properties: { mag: number | null; place: string | null; time: number; url: string; title: string; alert: string | null };
        }[];
      };
      return json.features
        .filter((f) => f.geometry)
        .map((f) => {
          const mag = f.properties.mag ?? 0;
          const alert = f.properties.alert;
          let level = quakeLevel(mag);
          if (alert === "red" || alert === "orange") level = alert;
          return {
            id: `usgs:${f.id}`,
            title: f.properties.title,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            level,
            type: "quake",
            source_url: f.properties.url,
            time: new Date(f.properties.time).toISOString(),
            source: "USGS",
            detail: `M${mag.toFixed(1)} · depth ${f.geometry.coordinates[2]?.toFixed(0) ?? "?"} km`,
          };
        });
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    // Phones start with the globe visible; the panel opens from the "Layers & feed" button.
    if (window.innerWidth < 640) setPanelOpen(false);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Engine lifecycle (three.js is browser-only, so it is imported here).
  useEffect(() => {
    let cancelled = false;
    let engine: GlobeEngine | null = null;
    void import("./engine")
      .then(({ GlobeEngine }) => {
        if (cancelled || !mountRef.current) return;
        engine = new GlobeEngine(mountRef.current, {
          onPick: (marker) => {
            setPicked(marker);
            if (marker) setPanelOpen(true);
          },
          onLayerState: (id, state, note) => setStates((prev) => ({ ...prev, [id]: { state, note } })),
          onSky: setSky,
        });
        engineRef.current = engine;
        // Test hook for local headless checks only (stripped from production builds).
        if (import.meta.env.DEV) (window as unknown as { __globe?: GlobeEngine }).__globe = engine;
        setEngineReady(true);
      })
      .catch((err: unknown) => setEngineError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const radar = atlas.data?.radar;
  const precipTemplate = useMemo(() => {
    const frame = radar?.frames[radar.frames.length - 1];
    return frame && radar ? `${radar.host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png` : undefined;
  }, [radar]);
  const sstTemplate = useMemo(() => {
    const layer = LAYER_BY_ID.get("sst");
    return layer ? tileTemplate(layer, defaultSettings(layer), dayStamp(0), DEPTHS[0]) : undefined;
  }, []);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    void e.setOverlay("clouds", toggles.clouds);
  }, [engineReady, toggles.clouds]);
  useEffect(() => {
    const e = engineRef.current;
    if (!e || (toggles.precip && !precipTemplate)) return;
    void e.setOverlay("precip", toggles.precip, { precipTemplate });
  }, [engineReady, toggles.precip, precipTemplate]);
  useEffect(() => {
    const e = engineRef.current;
    if (!e || (toggles.quakeHeat && !quakes.data)) return;
    void e.setOverlay("quakeHeat", toggles.quakeHeat, { quakes: quakes.data });
  }, [engineReady, toggles.quakeHeat, quakes.data]);
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    void e.setOverlay("sst", toggles.sst, { sstTemplate });
  }, [engineReady, toggles.sst, sstTemplate]);
  useEffect(() => {
    void engineRef.current?.setFaults(toggles.faultsActive, toggles.faultsDormant);
  }, [engineReady, toggles.faultsActive, toggles.faultsDormant]);
  useEffect(() => {
    void engineRef.current?.setBase(toggles.s2 ? "s2" : "bluemarble");
  }, [engineReady, toggles.s2]);
  useEffect(() => {
    engineRef.current?.setNightLights(toggles.night);
  }, [engineReady, toggles.night]);
  useEffect(() => {
    engineRef.current?.setMoonVisible(toggles.moon);
  }, [engineReady, toggles.moon]);

  // Markers + feed
  const allMarkers = useMemo(() => {
    const byId = new Map<string, GlobeMarker>();
    if (toggles.live) {
      for (const m of (atlas.data?.events ?? []).map(fromDisaster)) byId.set(m.id, m);
      for (const m of hourQuakes.data ?? []) if (!byId.has(m.id)) byId.set(m.id, m);
    }
    const x = toggles.x ? (xMarkers.data ?? []) : [];
    return [...byId.values(), ...x];
  }, [atlas.data, hourQuakes.data, xMarkers.data, toggles.live, toggles.x]);

  const windowMs = WINDOWS.find((w) => w.id === windowId)?.ms ?? Infinity;
  const nowBucket = Math.floor(now / 60_000);
  const shown = useMemo(() => {
    const cutoff = nowBucket * 60_000 - windowMs;
    const minRank = LEVEL_STYLE[minLevel].rank;
    return allMarkers
      .filter((m) => Date.parse(m.time) >= cutoff && LEVEL_STYLE[m.level].rank >= minRank)
      .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [allMarkers, windowMs, minLevel, nowBucket]);

  // If nothing at all happened in the last hour, widen once to 6 h so the globe is not empty on arrival.
  useEffect(() => {
    if (autoWidened || !now || atlas.isLoading || hourQuakes.isLoading || windowId !== "1h") return;
    setAutoWidened(true);
    if (shown.length === 0 && allMarkers.length > 0) setWindowId("6h");
  }, [autoWidened, now, atlas.isLoading, hourQuakes.isLoading, windowId, shown.length, allMarkers.length]);

  const shownKey = shown.map((m) => `${m.id}:${m.level}`).join("|");
  useEffect(() => {
    engineRef.current?.setMarkers(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, shownKey]);

  const counts = useMemo(() => {
    const c: Record<WarnLevel, number> = { green: 0, yellow: 0, orange: 0, red: 0 };
    for (const m of shown) c[m.level] += 1;
    return c;
  }, [shown]);

  const set = (key: keyof Toggles) => setToggles((t) => ({ ...t, [key]: !t[key] }));
  const focus = (m: GlobeMarker) => {
    setPicked(m);
    engineRef.current?.select(m.id, true);
  };

  const utc = now ? new Date(now).toISOString().slice(11, 19) : "--:--:--";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#02040a] text-cream">
      <style>{GLOBE_CSS}</style>
      <div ref={mountRef} className="absolute inset-0" aria-label="3D globe" role="img" />
      {engineError && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">
          The 3D globe needs WebGL, which this browser could not start ({engineError}).
        </div>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start gap-2 p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Link to="/" className="cm-back flex h-11 items-center gap-1.5 px-3 text-sm" aria-label="Back to the live map">
            <ArrowLeft className="size-4" />
            Live map
          </Link>
          <Link to="/copernicus" className="cm-back flex h-11 items-center gap-1.5 px-3 text-sm" aria-label="Open Copernicus mode">
            <Waves className="size-4" />
            Copernicus
          </Link>
          <div className="cm-title">
            <p className="font-display text-base font-bold tracking-[0.12em] uppercase sm:text-lg">3D Globe</p>
            <p className="text-[11px] text-muted">
              {utc} UTC · {atlas.isFetching ? "updating feeds…" : `${allMarkers.length} live markers`}
            </p>
          </div>
        </div>
      </header>

      {/* Sky card */}
      {sky && (
        <div className="cm-tile pointer-events-auto absolute bottom-3 left-3 z-20 hidden max-w-[19rem] space-y-1.5 p-3 text-xs sm:block">
          <p className="flex items-center gap-1.5">
            <Sun className="size-3.5 text-amber" />
            <span className="text-muted">Sun overhead</span>
            <span className="ml-auto font-mono">{formatLatLon(sky.sun.lat, sky.sun.lon)}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Moon className="size-3.5 text-cream" />
            <span className="text-muted">Moon overhead</span>
            <span className="ml-auto font-mono">{formatLatLon(sky.moon.lat, sky.moon.lon)}</span>
          </p>
          <div className="flex items-center gap-2">
            <MoonPhaseIcon deg={sky.moonPhaseDeg} />
            <div>
              <p>{sky.moonPhaseName}</p>
              <p className="text-muted">
                {Math.round(sky.moonLit * 100)}% lit · {Math.round(sky.moon.distKm).toLocaleString()} km
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted">Ephemeris: astronomy-engine, live from UTC. Moon distance shown compressed.</p>
        </div>
      )}

      <div className="pointer-events-auto absolute right-3 bottom-3 z-20 flex flex-col gap-2 sm:right-[25rem]">
        <button type="button" className="icon-btn" onClick={() => engineRef.current?.zoomBy(0.75)} aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button type="button" className="icon-btn" onClick={() => engineRef.current?.zoomBy(1.33)} aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            const s = engineRef.current?.sunLatLon();
            if (s) engineRef.current?.flyTo(s.lat * 0.5, s.lon - 90, 3.2);
          }}
          aria-label="Show the terminator"
          title="Show the day/night line"
        >
          <Globe2 className="size-4" />
        </button>
      </div>

      {!panelOpen && (
        <button
          type="button"
          className="cm-back pointer-events-auto absolute top-3 right-3 z-30 flex h-11 items-center gap-1.5 px-3 text-sm"
          onClick={() => setPanelOpen(true)}
        >
          <Layers className="size-4" /> Layers & feed
        </button>
      )}

      {panelOpen && (
        <aside className="cm-drawer pointer-events-auto absolute inset-x-2 bottom-2 z-30 flex max-h-[58dvh] sm:inset-x-auto sm:top-3 sm:right-3 sm:bottom-3 sm:max-h-none sm:w-[24rem]">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Layers className="size-4 text-fire" />
            <p className="font-display text-sm font-bold tracking-[0.12em] uppercase">Layers & live feed</p>
            <button type="button" className="ml-auto rounded p-1 text-muted hover:text-cream" onClick={() => setPanelOpen(false)} aria-label="Close panel">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Section title="Weather">
              <Toggle label="Clouds (satellite IR, 10 min)" on={toggles.clouds} onClick={() => set("clouds")} st={states.clouds} />
              <Toggle label="Precipitation radar (RainViewer)" on={toggles.precip} onClick={() => set("precip")} st={states.precip} />
            </Section>
            <Section title="Earth">
              <Toggle label="Earthquake heatmap (30 days)" on={toggles.quakeHeat} onClick={() => set("quakeHeat")} st={states.quakeHeat} />
              <Toggle label="Active faults" swatch="#ff4d2e" on={toggles.faultsActive} onClick={() => set("faultsActive")} st={states.faults} />
              <Toggle label="Dormant faults" swatch="#9fb4c8" on={toggles.faultsDormant} onClick={() => set("faultsDormant")} />
              <Toggle label="City lights at night" on={toggles.night} onClick={() => set("night")} />
              <Toggle label="Moon" on={toggles.moon} onClick={() => set("moon")} />
            </Section>
            <Section title="Copernicus">
              <Toggle label="Sentinel-2 cloudless imagery (EOX)" on={toggles.s2} onClick={() => set("s2")} st={states.s2} />
              <Toggle label="Sea temperature (Copernicus Marine)" on={toggles.sst} onClick={() => set("sst")} st={states.sst} />
            </Section>
            <Section title="Markers">
              <Toggle label="Live hazard feeds" on={toggles.live} onClick={() => set("live")} st={atlas.isError ? { state: "error", note: "feeds failed" } : undefined} />
              <Toggle label={`X scan markers (${xMarkers.data?.length ?? 0})`} on={toggles.x} onClick={() => set("x")} />
            </Section>

            <div className="border-t border-line px-3 pt-3 pb-1">
              <div className="flex flex-wrap gap-1">
                {WINDOWS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setWindowId(w.id)}
                    className={`rounded-md border px-2 py-1 text-xs ${windowId === w.id ? "border-fire bg-fire/20 text-cream" : "border-line text-muted"}`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {LEVELS.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setMinLevel(lv)}
                    title={`Show ${LEVEL_STYLE[lv].label} and above`}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${minLevel === lv ? "border-cream" : "border-line text-muted"}`}
                  >
                    <span className="globe-pulse inline-block size-2 rounded-full" style={{ background: LEVEL_STYLE[lv].color, color: LEVEL_STYLE[lv].color }} />
                    {LEVEL_STYLE[lv].label} {counts[lv] ? `· ${counts[lv]}` : ""}
                  </button>
                ))}
              </div>
            </div>

            {picked && (
              <div className="mx-3 mt-2 rounded-md border p-2 text-xs" style={{ borderColor: LEVEL_STYLE[picked.level].color }}>
                <p className="font-semibold">
                  {TYPE_EMOJI[picked.type] ?? "⚠️"} {picked.title}
                </p>
                <p className="mt-0.5 text-muted">
                  {LEVEL_STYLE[picked.level].label} · {picked.source} · {ago(picked.time, now)} · {formatLatLon(picked.lat, picked.lon)}
                </p>
                {picked.detail && <p className="mt-1 text-muted">{picked.detail}</p>}
                {picked.source_url && (
                  <a href={picked.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-cyan">
                    Source <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            )}

            <ul className="space-y-1 p-3">
              {atlas.isLoading && <li className="text-xs text-muted">Loading live feeds…</li>}
              {!atlas.isLoading && shown.length === 0 && (
                <li className="text-xs text-muted">Nothing in this window. Try 6 h or 24 h.</li>
              )}
              {shown.slice(0, 200).map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => focus(m)}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-panel-2 ${picked?.id === m.id ? "bg-panel-2" : ""}`}
                  >
                    <LevelIcon level={m.level} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">
                        {TYPE_EMOJI[m.type] ?? "⚠️"} {m.title}
                      </span>
                      <span className="text-[10px] text-muted">
                        {m.source} · {ago(m.time, now)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-3 pb-3 text-[10px] leading-snug text-muted">
              Basemap NASA GIBS Blue Marble + VIIRS Black Marble · clouds GIBS GOES-East/West & Himawari band 13 ·
              radar RainViewer · quakes USGS · faults GEM GAF-DB · Copernicus Sentinel-2 cloudless by EOX (CC BY-NC-SA 4.0) ·
              Copernicus Marine Service · events USGS, GDACS, NASA EONET, NOAA/NWS, Smithsonian GVP, NRCan, ECCC. Not an
              official warning service.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

const GLOBE_CSS = `
@keyframes globe-pulse { 0% { box-shadow: 0 0 0 0 currentColor; opacity: .9 } 100% { box-shadow: 0 0 0 7px transparent; opacity: .2 } }
.globe-pulse { animation: globe-pulse 1.4s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .globe-pulse { animation: none; } }
`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3">
      <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Toggle(props: {
  label: string;
  on: boolean;
  onClick: () => void;
  swatch?: string;
  st?: { state: LayerState; note?: string };
}) {
  const st = props.st;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      onClick={props.onClick}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-panel-2"
    >
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${props.on ? "bg-fire" : "bg-line"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-cream transition ${props.on ? "left-3.5" : "left-0.5"}`} />
      </span>
      {props.swatch && <span className="h-0.5 w-3 shrink-0" style={{ background: props.swatch }} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{props.label}</span>
        {props.on && st && st.state !== "off" && (st.state !== "ok" || st.note) && (
          <span className={`block truncate text-[10px] ${st.state === "error" ? "text-crimson" : "text-muted"}`}>
            {st.state === "loading" ? "loading…" : st.note ?? st.state}
          </span>
        )}
      </span>
    </button>
  );
}

function LevelIcon({ level }: { level: WarnLevel }) {
  const style = LEVEL_STYLE[level];
  const tri = level === "orange" || level === "red";
  return (
    <span className="relative mt-0.5 grid size-4 shrink-0 place-items-center" title={style.label}>
      <span
        className="globe-pulse absolute inset-0 rounded-full"
        style={{ color: style.color, animationDuration: `${1 / style.pulseHz}s` }}
      />
      {tri ? (
        <svg viewBox="0 0 16 16" className="relative size-4">
          <path d="M8 1.5 15 14H1z" fill={style.color} stroke="#070b12" strokeWidth="1" />
          <path d="M8 6v3.6M8 11.4v.6" stroke="#070b12" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <span className="relative size-2.5 rounded-full border border-[#070b12]" style={{ background: style.color }} />
      )}
    </span>
  );
}

/** Lit part of the Moon as seen from Earth (northern-hemisphere orientation). */
function MoonPhaseIcon({ deg }: { deg: number }) {
  const r = 14;
  const k = Math.cos((deg * Math.PI) / 180); // 1 new … -1 full
  const waxing = deg < 180;
  const rx = Math.abs(k) * r;
  // Bright limb on the right while waxing.
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = k > 0 ? (waxing ? 0 : 1) : waxing ? 1 : 0;
  const d = `M16 2 A${r} ${r} 0 0 ${sweepOuter} 16 30 A${rx} ${r} 0 0 ${sweepInner} 16 2Z`;
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-label="Moon phase">
      <circle cx="16" cy="16" r={r} fill="#1b2433" />
      <path d={d} fill="#e8eef6" />
    </svg>
  );
}

function ago(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  if (ms < 0) return "upcoming";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
