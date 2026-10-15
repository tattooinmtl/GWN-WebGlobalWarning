import { useCallback, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Layers, Pause, Play, X } from "lucide-react";
import { cmemsPoint } from "@/lib/copernicus/api";
import { DAY_OFFSETS, dayStamp, DEPTHS, defaultSettings, LAYERS, type LayerSettings } from "@/lib/copernicus/layers";
import { CmemsMap } from "./CmemsMap";
import { LayerMenu } from "./LayerMenu";
import { PointPanel } from "./PointPanel";

const STEP_MS = 1400;

export function CopernicusApp() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <CopernicusInner />
    </QueryClientProvider>
  );
}

function CopernicusInner() {
  const [settings, setSettings] = useState<Record<string, LayerSettings>>(() =>
    Object.fromEntries(LAYERS.map((layer) => [layer.id, defaultSettings(layer)])),
  );
  const [offset, setOffset] = useState(0);
  const [depth, setDepth] = useState<number>(DEPTHS[0]);
  const [playing, setPlaying] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const day = dayStamp(offset);
  const active = useMemo(() => LAYERS.filter((layer) => settings[layer.id].on), [settings]);
  const has3d = active.some((layer) => layer.depth);

  const patch = useCallback((id: string, change: Partial<LayerSettings>) => {
    setSettings((state) => ({ ...state, [id]: { ...state[id], ...change } }));
  }, []);

  // Playback steps one day once the map has drawn the current one, so slow tiles never get skipped.
  const [idleTick, setIdleTick] = useState(0);
  const onIdle = useCallback(() => setIdleTick((tick) => tick + 1), []);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      setOffset((value) => (value >= DAY_OFFSETS[DAY_OFFSETS.length - 1] ? DAY_OFFSETS[0] : value + 1));
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, idleTick]);

  const report = useQuery({
    queryKey: ["cmems-point", point?.lat, point?.lon, active.map((layer) => layer.id).join(","), depth],
    queryFn: () => cmemsPoint({ data: { lat: point!.lat, lon: point!.lon, layers: active.map((layer) => layer.id), depth } }),
    enabled: point !== null,
    staleTime: 600_000,
  });

  const dateText = new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const when = offset === 0 ? "Today" : offset < 0 ? `${-offset} day${offset === -1 ? "" : "s"} ago` : `Forecast +${offset} day${offset === 1 ? "" : "s"}`;

  return (
    <main className="cm-page relative h-dvh w-full overflow-hidden bg-bg text-cream">
      <CmemsMap settings={settings} day={day} depth={depth} point={point} onPick={(lat, lon) => setPoint({ lat, lon })} onIdle={onIdle} />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link to="/" className="cm-back" aria-label="Back to the live map">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Live map</span>
          </Link>
          <div className="cm-title">
            <p className="font-display text-xl font-bold uppercase leading-none tracking-widest">Copernicus mode</p>
            <p className="text-[11px] text-muted">EU ocean, weather &amp; air data · free &amp; live</p>
          </div>
        </div>
        <button type="button" className="cm-back pointer-events-auto md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open data layers">
          <Layers className="size-4" /> Layers
        </button>
      </header>

      <aside
        className={`cm-drawer absolute bottom-40 left-3 top-24 z-30 md:bottom-28 w-[19rem] max-w-[calc(100%-1.5rem)] ${menuOpen ? "flex" : "hidden md:flex"}`}
        aria-label="Data layers"
      >
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <p className="font-display text-lg uppercase leading-none tracking-wider text-amber">Data layers</p>
          <button type="button" className="icon-btn h-8 w-8 md:hidden" onClick={() => setMenuOpen(false)} aria-label="Close layers">
            <X className="size-4" />
          </button>
        </div>
        <div className="dock-scroll px-2 pb-3">
          <LayerMenu settings={settings} onChange={patch} />
        </div>
      </aside>

      {point ? (
        <aside className="cm-drawer absolute bottom-40 right-3 top-24 z-30 flex w-[22rem] md:bottom-28 max-w-[calc(100%-1.5rem)]" aria-label="Spot details">
          <div className="flex items-center justify-between px-3 pb-1 pt-3">
            <p className="font-display text-lg uppercase leading-none tracking-wider text-amber">This spot</p>
            <button type="button" className="icon-btn h-8 w-8" onClick={() => setPoint(null)} aria-label="Close spot details">
              <X className="size-4" />
            </button>
          </div>
          <div className="dock-scroll">
            <PointPanel
              report={report.data}
              loading={report.isLoading}
              error={report.isError ? "Could not read Copernicus data for this spot. Try again in a moment." : null}
              day={day}
            />
          </div>
        </aside>
      ) : null}

      <footer className="cm-timebar absolute inset-x-3 bottom-3 z-30 mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="cm-play"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? "Pause animation" : "Play animation"}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-lg leading-none">{dateText}</p>
              <p className={offset > 0 ? "text-xs text-amber" : "text-xs text-muted"}>{when}</p>
            </div>
            <input
              type="range"
              className="cm-range mt-1.5 w-full"
              min={DAY_OFFSETS[0]}
              max={DAY_OFFSETS[DAY_OFFSETS.length - 1]}
              step={1}
              value={offset}
              onChange={(event) => {
                setPlaying(false);
                setOffset(Number(event.target.value));
              }}
              aria-label="Day"
            />
          </div>
          {has3d ? (
            <label className="hidden flex-col text-[11px] text-muted sm:flex">
              Depth
              <select className="field mt-0.5 w-24 py-1" value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
                {DEPTHS.map((value) => (
                  <option key={value} value={value}>
                    {value < 1 ? "Surface" : `${Math.round(value)} m`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {has3d ? (
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted sm:hidden">
            Depth
            <select className="field w-28 py-1" value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
              {DEPTHS.map((value) => (
                <option key={value} value={value}>
                  {value < 1 ? "Surface" : `${Math.round(value)} m`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!point ? <p className="mt-1.5 text-center text-[11px] text-muted">Tap the map for rain in mm, sea temperature, waves, air quality and river flow at that spot.</p> : null}
      </footer>
    </main>
  );
}
