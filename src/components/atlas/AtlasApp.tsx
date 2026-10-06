import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Crosshair,
  Layers,
  LocateFixed,
  MessageSquare,
  Minus,
  Plus,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { blendOpenWeather, loadAtlas, pointForecast } from "@/lib/disasters/api";
import { buildAtlasModel, topCountries } from "@/lib/disasters/aggregate";
import { buildContext } from "@/lib/disasters/context";
import { ago, stampKey, weatherText } from "@/lib/disasters/format";
import { haversineKm, prepareCountries } from "@/lib/disasters/geo";
import type { CountryCollection, CountryStat, HazardKind, Metric, VolcanoCollection } from "@/lib/disasters/types";
import { KIND_LABEL, METRICS } from "@/lib/disasters/types";
import type { LayerPrefs } from "@/lib/atlas/store";
import { mergeLayers, useAtlas } from "@/lib/atlas/store";
import { CopilotDock } from "./CopilotDock";
import { HazardMap } from "./HazardMap";
import { PlacesDock } from "./PlacesDock";
import { SettingsForm } from "./SettingsForm";

export function AtlasApp() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AtlasInner />
    </QueryClientProvider>
  );
}

function AtlasInner() {
  const [hydrated, setHydrated] = useState(false);
  const queryClient = useQueryClient();
  const prefs = useAtlas((s) => s.prefs);
  const metric = useAtlas((s) => s.metric);
  const setMetric = useAtlas((s) => s.setMetric);
  const selectedIso = useAtlas((s) => s.selectedIso);
  const location = useAtlas((s) => s.location);
  const setLocation = useAtlas((s) => s.setLocation);
  const locStatus = useAtlas((s) => s.locStatus);
  const setLocStatus = useAtlas((s) => s.setLocStatus);
  const sheet = useAtlas((s) => s.sheet);
  const setSheet = useAtlas((s) => s.setSheet);
  const prefsOpen = useAtlas((s) => s.prefsOpen);
  const setPrefsOpen = useAtlas((s) => s.setPrefsOpen);
  const requestFly = useAtlas((s) => s.requestFly);
  const nudgeZoom = useAtlas((s) => s.nudgeZoom);
  const patchPrefs = useAtlas((s) => s.patchPrefs);
  const owmRain = useAtlas((s) => s.owmRain);
  const setOwmRain = useAtlas((s) => s.setOwmRain);
  const aiLayer = useAtlas((s) => s.aiLayer);
  const queuePrompt = useAtlas((s) => s.queuePrompt);
  const [frame, setFrame] = useState(0);
  const [radarPlay, setRadarPlay] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);

  useEffect(() => {
    void Promise.resolve(useAtlas.persist.rehydrate()).then(() => setHydrated(true));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setRadarPlay(false);
  }, []);

  const geoQuery = useQuery({
    queryKey: ["countries-geo"],
    queryFn: async () => {
      const res = await fetch("/geo/countries.geojson");
      if (!res.ok) throw new Error("Country boundaries failed to load");
      return (await res.json()) as CountryCollection;
    },
    staleTime: Infinity,
  });

  const volcanoQuery = useQuery({
    queryKey: ["volcano-catalog"],
    queryFn: async () => {
      const res = await fetch("/geo/volcanoes.geojson");
      if (!res.ok) throw new Error("Volcano catalog failed to load");
      return (await res.json()) as VolcanoCollection;
    },
    staleTime: Infinity,
  });

  const atlasQuery = useQuery({
    queryKey: ["atlas", stampKey(prefs.nasaKey)],
    enabled: hydrated,
    refetchInterval: 120_000,
    queryFn: () => loadAtlas({ data: { nasaKey: prefs.nasaKey } }),
  });

  const prep = useMemo(() => (geoQuery.data ? prepareCountries(geoQuery.data) : []), [geoQuery.data]);

  const blendPoints = useMemo(() => {
    if (!prep.length || !atlasQuery.data) return [];
    const rain = new Map(atlasQuery.data.precip.map((row) => [row.id, row.mm]));
    return prep
      .map((country) => ({ id: country.id, lat: country.lat, lon: country.lon, mm: rain.get(country.id) ?? 0 }))
      .sort((a, b) => b.mm - a.mm)
      .filter((country) => country.mm >= 8)
      .slice(0, 24)
      .map(({ id, lat, lon }) => ({ id, lat, lon }));
  }, [prep, atlasQuery.data]);

  const blendQuery = useQuery({
    queryKey: ["owm-blend", stampKey(prefs.owmKey), blendPoints.map((point) => point.id).join(",")],
    enabled: hydrated && Boolean(prefs.owmKey) && blendPoints.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    queryFn: () => blendOpenWeather({ data: { owmKey: prefs.owmKey, points: blendPoints } }),
  });

  useEffect(() => {
    if (!blendQuery.data) return;
    const next: Record<string, number> = {};
    for (const row of blendQuery.data.rows) next[row.id] = row.rain1h;
    setOwmRain(next);
  }, [blendQuery.data, setOwmRain]);

  const model = useMemo(() => {
    if (!prep.length) return null;
    return buildAtlasModel(prep, atlasQuery.data?.events ?? [], atlasQuery.data?.precip ?? [], metric, owmRain, aiLayer);
  }, [prep, atlasQuery.data, metric, owmRain, aiLayer]);

  const ranked = useMemo(() => (model ? topCountries(model.countries, 16) : []), [model]);
  const selected = model?.countries.find((country) => country.id === selectedIso) ?? null;

  const layers = mergeLayers(prefs.layers);

  const nearby = useMemo(() => {
    if (!location || !model) return [];
    const rows = model.events
      .map((event) => ({ event, km: haversineKm(location.lat, location.lon, event.lat, event.lon) }))
      .filter(({ event, km }) => {
        if (km > prefs.radiusKm) return false;
        if (event.kind === "quake") return (event.mag ?? 0) >= prefs.minQuakeAlert;
        return event.kind === "flood" || event.kind === "fire" || event.kind === "storm" || event.kind === "volcano" || event.kind === "landslide";
      });
    const year = new Date().getFullYear();
    for (const feature of volcanoQuery.data?.features ?? []) {
      const last = feature.properties.year;
      if (last == null || last < year - 1) continue;
      const [lon, lat] = feature.geometry.coordinates;
      const km = haversineKm(location.lat, location.lon, lat, lon);
      if (km > prefs.radiusKm) continue;
      const already = model.events.some(
        (event) => event.kind === "volcano" && Math.abs(event.lon - lon) < 0.5 && Math.abs(event.lat - lat) < 0.5,
      );
      if (already) continue;
      rows.push({
        km,
        event: {
          id: `gvp:${feature.properties.id}`,
          source: "Smithsonian",
          kind: "volcano",
          title: `${feature.properties.name} erupting`,
          mag: null,
          alert: "orange",
          lat,
          lon,
          time: new Date().toISOString(),
          url: `https://volcano.si.edu/volcano.cfm?vn=${feature.properties.id}`,
          place: feature.properties.country,
          isoHint: "",
          detail: last < 0 ? `Last eruption ${Math.abs(last)} BCE` : `Last eruption ${last}`,
          countryId: "",
          countryName: feature.properties.country,
        },
      });
    }
    return rows.sort((a, b) => a.km - b.km).slice(0, 8);
  }, [location, model, prefs.radiusKm, prefs.minQuakeAlert, volcanoQuery.data]);

  const here = useQuery({
    queryKey: ["here", location?.lat.toFixed(2), location?.lon.toFixed(2), stampKey(prefs.owmKey)],
    enabled: Boolean(location),
    staleTime: 10 * 60 * 1000,
    queryFn: () =>
      pointForecast({
        data: { lat: location!.lat, lon: location!.lon, owmKey: prefs.owmKey },
      }),
  });

  const context = useMemo(() => {
    if (!atlasQuery.data || !model) return "Feeds have not loaded.";
    return (
      buildContext({
        payload: atlasQuery.data,
        metric,
        countries: model.countries,
        selected,
        location,
        radiusKm: prefs.radiusKm,
        nearby: nearby.map((item) => ({
          title: item.event.title,
          kind: item.event.kind,
          km: item.km,
          mag: item.event.mag,
          source: item.event.source,
        })),
      }) +
      " Volcano layer: Smithsonian Holocene catalog, 1214 volcanoes. Gold means last eruption this year or last year, or a live eruption report nearby. Orange means an eruption in the last 50 years. Gray is dormant. Fault layer: GEM Global Active Faults. Amber traces are Holocene, historic, or undated active faults, including plate boundaries. Gray dashed traces last moved before the Holocene."
    );
  }, [atlasQuery.data, model, metric, selected, location, prefs.radiusKm, nearby]);

  const frames = atlasQuery.data?.radar?.frames.length ?? 0;
  useEffect(() => {
    if (!radarPlay || frames < 2) return;
    const id = window.setInterval(() => setFrame((current) => (current + 1) % frames), 1100);
    return () => window.clearInterval(id);
  }, [radarPlay, frames]);

  const metricMeta = METRICS.find((item) => item.id === metric) ?? METRICS[0];
  const updated = atlasQuery.data ? ago(atlasQuery.data.fetchedAt) : "";

  function pick(country: CountryStat) {
    useAtlas.getState().setSelectedIso(country.id);
    requestFly(country.lon, country.lat, 4.2);
    if (window.matchMedia("(max-width: 767px)").matches) setSheet("places");
  }

  async function locate() {
    setLocStatus("locating");
    const gps = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
      );
    });
    if (gps) {
      setLocation({
        lat: gps.coords.latitude,
        lon: gps.coords.longitude,
        label: "Your position",
        at: Date.now(),
        approximate: false,
      });
      requestFly(gps.coords.longitude, gps.coords.latitude, 5);
      setLocStatus("ready");
      return;
    }
    try {
      const res = await fetch("https://ipwho.is/");
      const body = (await res.json()) as {
        success?: boolean;
        latitude?: number;
        longitude?: number;
        city?: string;
        country?: string;
      };
      if (body.success && typeof body.latitude === "number" && typeof body.longitude === "number") {
        setLocation({
          lat: body.latitude,
          lon: body.longitude,
          label: [body.city, body.country].filter(Boolean).join(", ") || "Approximate",
          at: Date.now(),
          approximate: true,
        });
        requestFly(body.longitude, body.latitude, 4.6);
        setLocStatus("ready");
        return;
      }
    } catch {
      /* GPS and network location both failed */
    }
    setLocStatus("denied");
  }

  function toggleLayer(key: keyof LayerPrefs) {
    const current = mergeLayers(prefs.layers);
    if (key === "owmTiles" && !prefs.owmKey) {
      setPrefsOpen(true);
      return;
    }
    patchPrefs({ layers: { ...current, [key]: !current[key] } });
  }

  const showAlert = prefs.alertsOn && location && nearby.length > 0;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-cream">
      <HazardMap
        geo={geoQuery.data ?? null}
        countries={model?.countries ?? []}
        events={model?.events ?? []}
        volcanoes={volcanoQuery.data ?? null}
        radar={atlasQuery.data?.radar ?? null}
        frame={frame}
        layers={layers}
        owmKey={prefs.owmKey}
        radiusKm={prefs.radiusKm}
        location={location}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-full border border-line bg-panel/90 px-3 py-2 backdrop-blur-md">
            <p className="flex items-center gap-2 font-display text-xl leading-none tracking-widest">
              <span className="live-dot inline-block size-2 rounded-full bg-crimson" aria-hidden />
              MERIDIAN
            </p>
            <p className="text-xs text-muted">{updated ? `Live · ${updated}` : "Connecting feeds"}</p>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button type="button" className="icon-btn hidden sm:inline-flex" onClick={() => nudgeZoom(0.6)} aria-label="Zoom in">
            <Plus className="size-4" />
          </button>
          <button type="button" className="icon-btn hidden sm:inline-flex" onClick={() => nudgeZoom(-0.6)} aria-label="Zoom out">
            <Minus className="size-4" />
          </button>
          <button type="button" className="icon-btn" onClick={() => void locate()} aria-label="Go to my location">
            <LocateFixed className={locStatus === "locating" ? "size-4 animate-pulse" : "size-4"} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["atlas"] })}
            aria-label="Refresh feeds"
          >
            <RefreshCw className={atlasQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setLayersOpen((open) => !open)} aria-label="Map layers">
            <Layers className="size-4" />
          </button>
          <button type="button" className="icon-btn lg:hidden" onClick={() => setSheet(sheet === "agent" ? null : "agent")} aria-label="Open agent">
            <MessageSquare className="size-4" />
          </button>
          <button type="button" className="icon-btn" onClick={() => setPrefsOpen(true)} aria-label="Preferences">
            <Settings className="size-4" />
          </button>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 hidden text-center lg:block">
        <p className="font-display text-sm tracking-widest text-amber title-shadow">WORLDWIDE</p>
        <h1 className="font-display text-6xl leading-none text-cream title-shadow">{metricMeta.kicker}</h1>
      </div>

      <div className="absolute left-3 top-20 z-20 hidden h-[calc(100%-6.5rem)] w-72 md:flex xl:w-80">
        <PlacesDock
          countries={ranked}
          selected={selected}
          sources={atlasQuery.data?.sources ?? []}
          loading={atlasQuery.isLoading || geoQuery.isLoading}
          error={atlasQuery.error instanceof Error ? atlasQuery.error.message : geoQuery.error instanceof Error ? geoQuery.error.message : null}
          onRetry={() => void atlasQuery.refetch()}
          nearby={nearby}
          onPick={pick}
          onAsk={(prompt) => {
            queuePrompt(prompt);
            if (window.matchMedia("(max-width: 1023px)").matches) setSheet("agent");
          }}
        />
      </div>

      <div className="absolute right-3 top-20 z-20 hidden h-[calc(100%-6.5rem)] w-80 lg:flex">
        <CopilotDock
          context={context}
          headlines={atlasQuery.data?.headlines ?? []}
          spaceWeather={atlasQuery.data?.spaceWeather ?? []}
          countries={model?.countries ?? []}
          metric={metric}
        />
      </div>

      {showAlert ? (
        <div className="absolute inset-x-3 top-20 z-30 md:left-80 md:right-auto md:w-80 lg:left-1/2 lg:w-96 lg:-translate-x-1/2" role="status">
          <button
            type="button"
            className="w-full rounded-2xl border border-crimson bg-panel/95 px-3 py-2 text-left shadow-lg"
            onClick={() => {
              const first = nearby[0];
              if (!first) return;
              requestFly(first.event.lon, first.event.lat, 5.5);
              useAtlas.getState().setSelectedEventId(first.event.id);
              if (first.event.countryId) useAtlas.getState().setSelectedIso(first.event.countryId);
            }}
          >
            <p className="font-display text-lg leading-none tracking-wide text-amber">
              {nearby.length} hazard{nearby.length === 1 ? "" : "s"} inside {prefs.radiusKm} km
            </p>
            <p className="mt-1 text-sm">
              Closest: {KIND_LABEL[nearby[0].event.kind]}
              {nearby[0].event.mag != null ? ` M${nearby[0].event.mag}` : ""} · {Math.round(nearby[0].km)} km · {nearby[0].event.title}
            </p>
            <p className="text-xs text-muted">
              {location?.approximate ? "Approximate location. " : ""}
              {here.data ? `${weatherText(here.data.code)}${here.data.tempC != null ? ` · ${Math.round(here.data.tempC)}°C` : ""}` : location?.label}
            </p>
          </button>
        </div>
      ) : null}

      {locStatus === "denied" ? (
        <p className="absolute left-3 right-3 top-20 z-30 rounded-xl border border-line bg-panel px-3 py-2 text-sm md:left-80 md:max-w-sm">
          Location is blocked. The world map still updates. Allow location to arm radius warnings, or try again.
        </p>
      ) : null}

      <div className="absolute inset-x-3 bottom-16 z-20 flex justify-center md:bottom-4 md:left-80 lg:right-96">
        <div className="w-full max-w-md rounded-2xl border border-line bg-panel/90 p-3 backdrop-blur-md">
          <div className="mb-2 flex gap-1 overflow-x-auto">
            {METRICS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip shrink-0"
                data-on={metric === item.id ? "true" : "false"}
                onClick={() => setMetric(item.id as Metric)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="ramp" />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>Quiet</span>
            <span>Extreme</span>
          </div>
          <p className="mt-1 text-xs text-muted">{metricMeta.blurb}</p>
          {!prefs.hintDismissed ? (
            <p className="mt-1 text-xs text-muted">
              Feeds run without keys.{" "}
              <button type="button" className="text-amber" onClick={() => setPrefsOpen(true)}>
                Add OpenWeather or MiniMax
              </button>{" "}
              for station rain and the headline agent.{" "}
              <button type="button" className="text-cream" onClick={() => patchPrefs({ hintDismissed: true })}>
                Hide
              </button>
            </p>
          ) : null}
          {aiLayer && aiLayer.metric === metric ? (
            <p className="mt-1 text-xs text-amber">Agent blend on: {aiLayer.note || "weights mixed with the live index."}</p>
          ) : null}
          {blendQuery.data?.error ? <p className="mt-1 text-xs text-crimson">{blendQuery.data.error}</p> : null}
          {prefs.owmKey && blendQuery.data && !blendQuery.data.error ? (
            <p className="mt-1 text-xs text-cyan">OpenWeather rain blended into {blendQuery.data.rows.length} countries.</p>
          ) : null}
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span className="flex gap-2">
              <Key kind="flood" />
              <Key kind="quake" />
              <Key kind="fire" />
              <Key kind="storm" />
            </span>
            <button type="button" className="chip h-8 px-2" data-on={radarPlay ? "true" : "false"} onClick={() => setRadarPlay((play) => !play)}>
              Radar {radarPlay ? "playing" : "paused"}
            </button>
          </div>
        </div>
      </div>

      {layersOpen ? (
        <div className="absolute right-3 top-20 z-40 w-64 rounded-2xl border border-line bg-panel p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-xl leading-none">Layers</p>
            <button type="button" className="icon-btn h-9 w-9" onClick={() => setLayersOpen(false)} aria-label="Close layers">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <LayerRow label="Country color" on={prefs.layers.choropleth} onClick={() => toggleLayer("choropleth")} />
            <LayerRow label="Rain radar" on={prefs.layers.radar} onClick={() => toggleLayer("radar")} />
            <LayerRow label="OpenWeather tiles" on={prefs.layers.owmTiles} onClick={() => toggleLayer("owmTiles")} />
            <LayerRow label="Quakes" on={prefs.layers.quakes} onClick={() => toggleLayer("quakes")} />
            <LayerRow label="Floods" on={prefs.layers.floods} onClick={() => toggleLayer("floods")} />
            <LayerRow label="Fires" on={prefs.layers.fires} onClick={() => toggleLayer("fires")} />
            <LayerRow label="Storms" on={prefs.layers.storms} onClick={() => toggleLayer("storms")} />
            <LayerRow label="Volcanoes" on={layers.volcanoes} onClick={() => toggleLayer("volcanoes")} />
            <LayerRow label="Active faults" on={layers.faultsActive} onClick={() => toggleLayer("faultsActive")} />
            <LayerRow label="Dormant faults" on={layers.faultsDormant} onClick={() => toggleLayer("faultsDormant")} />
            <LayerRow label="Other hazards" on={layers.other} onClick={() => toggleLayer("other")} />
            <LayerRow label="Alert radius" on={layers.radius} onClick={() => toggleLayer("radius")} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Volcanoes are the Smithsonian Holocene catalog. Gold is erupting, orange erupted in the last 50 years, gray is dormant.
            Amber faults are active. Gray dashed faults last moved before the Holocene. GEM Global Active Faults.
          </p>
          <p className="mt-2 text-xs text-muted">Tiles use more of an OpenWeather quota than the 24-point blend.</p>
        </div>
      ) : null}

      {prefsOpen ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-bg/70 p-3 md:items-center" onClick={() => setPrefsOpen(false)}>
          <div className="dock w-full max-w-lg" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Preferences">
            <SettingsForm onClose={() => setPrefsOpen(false)} />
          </div>
        </div>
      ) : null}

      {sheet ? (
        <div className="absolute inset-x-0 bottom-14 top-16 z-30 px-3 lg:hidden">
          <div className="dock h-full">
            <div className="flex justify-end border-b border-line px-2 py-1 lg:hidden">
              <button type="button" className="icon-btn h-9 w-9" onClick={() => setSheet(null)} aria-label="Close panel">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {sheet === "places" ? (
                <PlacesDock
                  countries={ranked}
                  selected={selected}
                  sources={atlasQuery.data?.sources ?? []}
                  loading={atlasQuery.isLoading}
                  error={atlasQuery.error instanceof Error ? atlasQuery.error.message : null}
                  onRetry={() => void atlasQuery.refetch()}
                  nearby={nearby}
                  onPick={pick}
                  onAsk={(prompt) => {
                    queuePrompt(prompt);
                    setSheet("agent");
                  }}
                />
              ) : null}
              {sheet === "agent" ? (
                <CopilotDock
                  context={context}
                  headlines={atlasQuery.data?.headlines ?? []}
                  spaceWeather={atlasQuery.data?.spaceWeather ?? []}
                  countries={model?.countries ?? []}
                  metric={metric}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="absolute inset-x-0 bottom-0 z-30 flex border-t border-line bg-panel pb-[max(0.4rem,env(safe-area-inset-bottom))] md:hidden">
        <NavButton label="Places" icon={<Crosshair className="size-4" />} on={sheet === "places"} onClick={() => setSheet(sheet === "places" ? null : "places")} />
        <NavButton label="Agent" icon={<MessageSquare className="size-4" />} on={sheet === "agent"} onClick={() => setSheet(sheet === "agent" ? null : "agent")} />
        <NavButton label="Prefs" icon={<Settings className="size-4" />} on={prefsOpen} onClick={() => setPrefsOpen(true)} />
      </nav>
    </main>
  );
}

function Key({ kind }: { kind: HazardKind }) {
  const color = kind === "quake" ? "bg-crimson" : kind === "flood" ? "bg-cyan" : kind === "fire" ? "bg-fire" : "bg-storm";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`size-2 rounded-full ${color}`} />
      {KIND_LABEL[kind]}
    </span>
  );
}

function LayerRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-panel-2">
      <span>{label}</span>
      <span className={on ? "text-amber" : "text-muted"}>{on ? "On" : "Off"}</span>
    </button>
  );
}

function NavButton({ label, icon, on, onClick }: { label: string; icon: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs" data-on={on ? "true" : "false"}>
      <span className={on ? "text-amber" : "text-cream"}>{icon}</span>
      <span className={on ? "text-amber" : "text-muted"}>{label}</span>
    </button>
  );
}
