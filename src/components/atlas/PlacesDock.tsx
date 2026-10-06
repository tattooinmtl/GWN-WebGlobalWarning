import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crosshair } from "lucide-react";
import { pointForecast } from "@/lib/disasters/api";
import { ago, compactPop, stampKey, weatherText } from "@/lib/disasters/format";
import { haversineKm } from "@/lib/disasters/geo";
import type { CountryStat, SourceStatus } from "@/lib/disasters/types";
import { KIND_LABEL } from "@/lib/disasters/types";
import { useAtlas } from "@/lib/atlas/store";

type Nearby = { event: CountryStat["events"][number]; km: number };

type Props = {
  countries: CountryStat[];
  selected: CountryStat | null;
  sources: SourceStatus[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  nearby: Nearby[];
  onPick: (country: CountryStat) => void;
  onAsk: (prompt: string) => void;
};

export function PlacesDock({ countries, selected, sources, loading, error, onRetry, nearby, onPick, onAsk }: Props) {
  const prefs = useAtlas((s) => s.prefs);
  const location = useAtlas((s) => s.location);
  const selectedEventId = useAtlas((s) => s.selectedEventId);
  const setSelectedIso = useAtlas((s) => s.setSelectedIso);
  const setSelectedEventId = useAtlas((s) => s.setSelectedEventId);
  const requestFly = useAtlas((s) => s.requestFly);

  const forecast = useQuery({
    queryKey: ["point", selected?.id, stampKey(prefs.owmKey)],
    enabled: Boolean(selected),
    staleTime: 10 * 60 * 1000,
    queryFn: () =>
      pointForecast({
        data: { lat: selected!.lat, lon: selected!.lon, owmKey: prefs.owmKey },
      }),
  });

  return (
    <section className="dock h-full" aria-label="Countries">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        {selected ? (
          <button type="button" className="icon-btn h-10 w-10" onClick={() => setSelectedIso(null)} aria-label="Back to countries">
            <ArrowLeft className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none tracking-wide">{selected ? selected.name : "Hotspots"}</p>
          <p className="text-xs text-muted">
            {selected ? selected.continent : loading ? "Pulling live feeds…" : `${countries.length} countries with signal`}
          </p>
        </div>
      </header>
      <div className="dock-scroll px-3 py-3">
        {error ? (
          <div className="rounded-xl border border-crimson/50 bg-panel-2 p-3 text-sm">
            <p>The live feeds did not load.</p>
            <p className="mt-1 text-muted">{error}</p>
            <button type="button" className="chip mt-3" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}
        {!selected ? (
          <ul className="flex flex-col gap-2">
            {countries.map((country) => (
              <li key={country.id}>
                <button
                  type="button"
                  onClick={() => onPick(country)}
                  className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-left hover:border-muted"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-xl leading-none tracking-wide">{country.name}</span>
                    <span className="tabular-nums text-sm text-amber">{Math.round(country.score * 100)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${Math.max(4, Math.round(country.score * 100))}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {country.precipMm.toFixed(0)} mm rain
                    {country.counts.flood ? ` · ${country.counts.flood} flood` : ""}
                    {country.counts.quake ? ` · ${country.counts.quake} quake` : ""}
                    {country.maxMag ? ` · M${country.maxMag}` : ""}
                    {country.counts.fire ? ` · ${country.counts.fire} fire` : ""}
                    {country.counts.storm ? ` · ${country.counts.storm} storm` : ""}
                  </p>
                </button>
              </li>
            ))}
            {!loading && countries.length === 0 ? (
              <li className="text-sm text-muted">No elevated countries in this metric yet.</li>
            ) : null}
          </ul>
        ) : (
          <CountryDetail
            country={selected}
            location={location}
            radiusKm={prefs.radiusKm}
            nearby={nearby}
            forecast={forecast.data}
            forecastError={forecast.isError ? "Forecast unavailable" : null}
            selectedEventId={selectedEventId}
            onEvent={(event) => {
              setSelectedEventId(event.id);
              requestFly(event.lon, event.lat, 5);
            }}
            onCenter={() => requestFly(selected.lon, selected.lat, 4.2)}
            onAsk={() => onAsk(`What is happening in ${selected.name} right now? Use only the live feeds.`)}
          />
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {sources.map((source) => (
            <span
              key={source.id}
              className="rounded-full border border-line px-2 py-1 text-xs text-muted"
              title={source.error || `${source.ms} ms`}
            >
              <span className={source.ok ? "text-cyan" : "text-crimson"}>{source.ok ? "●" : "○"}</span> {source.label}{" "}
              {source.ok ? source.count : "down"}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CountryDetail({
  country,
  location,
  radiusKm,
  nearby,
  forecast,
  forecastError,
  selectedEventId,
  onEvent,
  onCenter,
  onAsk,
}: {
  country: CountryStat;
  location: { lat: number; lon: number } | null;
  radiusKm: number;
  nearby: Nearby[];
  forecast: Awaited<ReturnType<typeof pointForecast>> | undefined;
  forecastError: string | null;
  selectedEventId: string | null;
  onEvent: (event: CountryStat["events"][number]) => void;
  onCenter: () => void;
  onAsk: () => void;
}) {
  const distance = location ? haversineKm(location.lat, location.lon, country.lat, country.lon) : null;
  const inside = nearby.filter((item) => item.event.countryId === country.id);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        Pop {compactPop(country.pop)} · pressure {Math.round(country.score * 100)} · {country.eventTotal} events in the feed
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full bg-amber" style={{ width: `${Math.max(4, Math.round(country.score * 100))}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Rain window" value={`${country.precipMm.toFixed(1)} mm`} />
        <Stat label="OpenWeather 1h" value={country.owmRain == null ? "—" : `${country.owmRain.toFixed(1)} mm`} />
        <Stat label="Strongest quake" value={country.maxMag ? `M${country.maxMag}` : "—"} />
        <Stat label="Flood alert" value={country.maxFloodAlert === "info" ? "—" : country.maxFloodAlert} />
      </dl>
      {distance != null ? (
        <p className={distance <= radiusKm ? "text-amber" : "text-muted"}>
          {Math.round(distance)} km from you{distance <= radiusKm ? " · inside your alert radius" : ""}
        </p>
      ) : null}
      <div className="rounded-xl border border-line bg-panel-2 p-3">
        <p className="text-xs uppercase tracking-widest text-muted">At the label point</p>
        {forecast ? (
          <p className="mt-1">
            {weatherText(forecast.code)}
            {forecast.tempC != null ? ` · ${Math.round(forecast.tempC)}°C` : ""}
            {forecast.windKmh != null ? ` · wind ${Math.round(forecast.windKmh)} km/h` : ""}
            {forecast.owm?.description ? ` · OpenWeather ${forecast.owm.description}` : ""}
            {forecast.place ? ` · ${forecast.place}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-muted">{forecastError || "Reading Open-Meteo…"}</p>
        )}
        {forecast?.owmError ? <p className="mt-1 text-crimson">{forecast.owmError}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip" onClick={onCenter}>
          <Crosshair className="size-4" /> Center
        </button>
        <button type="button" className="chip" onClick={onAsk}>
          Ask the agent
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {country.events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onEvent(event)}
              data-on={selectedEventId === event.id ? "true" : "false"}
              className="w-full rounded-xl border border-line px-3 py-2 text-left data-[on=true]:border-amber"
            >
              <span className="text-xs uppercase tracking-wider text-amber">
                {KIND_LABEL[event.kind]} · {event.source}
                {event.mag != null ? ` · M${event.mag}` : ""} · {event.alert}
              </span>
              <p className="mt-0.5">{event.title}</p>
              <p className="text-xs text-muted">
                {ago(event.time)}
                {event.detail ? ` · ${event.detail}` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {country.eventTotal > country.events.length ? (
        <p className="text-xs text-muted">{country.eventTotal - country.events.length} older events hidden.</p>
      ) : null}
      {inside.length ? <p className="text-xs text-muted">{inside.length} of these sit inside your radius.</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}
