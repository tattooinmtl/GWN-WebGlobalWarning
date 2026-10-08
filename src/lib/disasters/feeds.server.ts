import { SAMPLE_POINTS } from "./samples";
import type {
  AlertLevel,
  AtlasPayload,
  DisasterEvent,
  EventSource,
  HazardKind,
  Headline,
  OwmSample,
  PointForecast,
  SourceStatus,
} from "./types";

const UA = "GWNAtlas/0.0.3 (educational live hazard map)";

let atlasCache: { at: number; payload: AtlasPayload } | null = null;
const ATLAS_TTL = 90_000;

let owmCache: { stamp: string; at: number; rows: OwmSample[] } | null = null;

function failMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") return "timed out";
    return err.message.slice(0, 160);
  }
  return "failed";
}

async function getText(url: string, ms = 12000, headers?: Record<string, string>): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, application/geo+json, application/xml, text/xml, */*",
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function timed<T>(
  sources: SourceStatus[],
  id: string,
  label: string,
  fn: () => Promise<{ value: T; count: number }>,
): Promise<T | null> {
  const t0 = Date.now();
  try {
    const { value, count } = await fn();
    sources.push({ id, label, ok: true, count, ms: Date.now() - t0, error: null });
    return value;
  } catch (err) {
    sources.push({ id, label, ok: false, count: 0, ms: Date.now() - t0, error: failMessage(err) });
    return null;
  }
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function strip(value: unknown, max = 180): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asAlert(raw: string | undefined, mag: number | null): AlertLevel {
  const v = (raw || "").toLowerCase();
  if (v === "red" || v === "extreme") return "red";
  if (v === "orange" || v === "severe") return "orange";
  if (v === "green" || v === "moderate" || v === "minor") return "green";
  if ((mag ?? 0) >= 7) return "red";
  if ((mag ?? 0) >= 5.5) return "orange";
  if ((mag ?? 0) >= 4.5) return "green";
  return "info";
}

function eventBase(partial: Omit<DisasterEvent, "title" | "place" | "detail" | "url" | "isoHint"> & {
  title?: string;
  place?: string;
  detail?: string;
  url?: string;
  isoHint?: string;
}): DisasterEvent {
  return {
    ...partial,
    title: strip(partial.title, 160) || partial.kind,
    place: strip(partial.place, 140),
    detail: strip(partial.detail, 180),
    url: strip(partial.url, 300),
    isoHint: strip(partial.isoHint, 8).toUpperCase(),
  };
}

function parseUsgs(text: string): DisasterEvent[] {
  const json = JSON.parse(text) as {
    features?: {
      id?: string;
      geometry?: { coordinates?: number[] };
      properties?: {
        mag?: number;
        place?: string;
        time?: number;
        url?: string;
        title?: string;
        tsunami?: number;
      };
    }[];
  };
  const out: DisasterEvent[] = [];
  for (const feature of json.features ?? []) {
    const coords = feature.geometry?.coordinates;
    const lon = coords?.[0];
    const lat = coords?.[1];
    const depth = coords?.[2];
    const props = feature.properties ?? {};
    if (lon == null || lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const mag = num(props.mag);
    const when = num(props.time);
    if (when == null) continue;
    const detail = [
      depth != null && Number.isFinite(depth) ? `Depth ${Math.round(depth)} km` : "",
      props.tsunami === 1 ? "Tsunami flag" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    out.push(
      eventBase({
        id: `usgs:${feature.id || `${lon},${lat},${when}`}`,
        source: "USGS",
        kind: "quake",
        title: props.title || props.place || "Earthquake",
        mag: mag == null ? null : Math.round(mag * 10) / 10,
        alert: asAlert(undefined, mag),
        lat,
        lon,
        time: new Date(when).toISOString(),
        url: props.url || "",
        place: props.place || "",
        detail,
      }),
    );
  }
  return out;
}

async function loadUsgs(): Promise<{ value: DisasterEvent[]; count: number }> {
  const urls = [
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
  ];
  const batches = await Promise.all(urls.map(async (url) => parseUsgs(await getText(url, 14000))));
  const merged = new Map<string, DisasterEvent>();
  for (const batch of batches) {
    for (const event of batch) {
      if (!merged.has(event.id)) merged.set(event.id, event);
    }
  }
  const quakes = [...merged.values()].sort(
    (a, b) => (b.mag ?? 0) - (a.mag ?? 0) || b.time.localeCompare(a.time),
  );
  const kept: DisasterEvent[] = [];
  let small = 0;
  for (const quake of quakes) {
    if ((quake.mag ?? 0) >= 4.5) kept.push(quake);
    else if (small < 320) {
      kept.push(quake);
      small += 1;
    }
  }
  return { value: kept, count: kept.length };
}

const EONET_KIND: Record<string, HazardKind | "skip"> = {
  wildfires: "fire",
  severeStorms: "storm",
  volcanoes: "volcano",
  floods: "flood",
  earthquakes: "quake",
  landslides: "landslide",
  drought: "drought",
  tempExtremes: "other",
  dustHaze: "skip",
  seaLakeIce: "skip",
  snow: "skip",
  waterColor: "skip",
  manmade: "skip",
};

function parseEonet(text: string): DisasterEvent[] {
  const json = JSON.parse(text) as {
    events?: {
      id?: string;
      title?: string;
      link?: string;
      categories?: { id?: string; title?: string }[];
      sources?: { id?: string }[];
      geometry?: { type?: string; coordinates?: number[]; date?: string; magnitudeValue?: number; magnitudeUnit?: string }[];
    }[];
  };
  const out: DisasterEvent[] = [];
  for (const event of json.events ?? []) {
    const category = event.categories?.[0]?.id || "";
    const kind = EONET_KIND[category] ?? "other";
    if (kind === "skip") continue;
    const geometries = event.geometry ?? [];
    let point: (typeof geometries)[number] | undefined;
    for (let i = geometries.length - 1; i >= 0; i--) {
      if (geometries[i]?.type === "Point" && Array.isArray(geometries[i].coordinates)) {
        point = geometries[i];
        break;
      }
    }
    const lon = point?.coordinates?.[0];
    const lat = point?.coordinates?.[1];
    if (lon == null || lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const magValue = num(point?.magnitudeValue);
    const unit = point?.magnitudeUnit ? ` ${point.magnitudeUnit}` : "";
    const title = event.title || category;
    if (kind === "fire" && /prescribed|\brx\b|pile burn|debris burn/i.test(title)) continue;
    const acres = kind === "fire" && /acre/i.test(String(point?.magnitudeUnit || "")) ? magValue : null;
    if (acres != null && acres < 400) continue;
    out.push(
      eventBase({
        id: `eonet:${event.id || `${lat},${lon}`}`,
        source: "NASA EONET",
        kind,
        title,
        mag: kind === "quake" ? magValue : null,
        alert: kind === "quake" ? asAlert(undefined, magValue) : "green",
        lat,
        lon,
        time: point?.date || new Date().toISOString(),
        url: event.link || "",
        place: event.categories?.[0]?.title || "",
        detail: magValue != null && kind !== "quake" ? `${magValue}${unit} · ${event.sources?.[0]?.id || "EONET"}` : event.sources?.[0]?.id || "",
      }),
    );
  }
  return out;
}

const GDACS_KIND: Record<string, HazardKind> = {
  FL: "flood",
  TC: "storm",
  VO: "volcano",
  WF: "fire",
  DR: "drought",
  EQ: "quake",
};

function parseGdacs(text: string): DisasterEvent[] {
  const json = JSON.parse(text) as {
    features?: {
      geometry?: { type?: string; coordinates?: unknown };
      properties?: {
        eventtype?: string;
        eventid?: number;
        name?: string;
        description?: string;
        htmldescription?: string;
        alertlevel?: string;
        fromdate?: string;
        url?: { report?: string };
        affectedcountries?: { iso2?: string }[];
        severitydata?: { severitytext?: string };
        country?: string;
      };
    }[];
  };
  const out: DisasterEvent[] = [];
  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {};
    const kind = GDACS_KIND[props.eventtype || ""];
    if (!kind || kind === "quake") continue;
    const coords = feature.geometry?.coordinates;
    let lon: number | null = null;
    let lat: number | null = null;
    if (feature.geometry?.type === "Point" && Array.isArray(coords)) {
      lon = num((coords as number[])[0]);
      lat = num((coords as number[])[1]);
    } else if (feature.geometry?.type === "Polygon" && Array.isArray(coords)) {
      const ring = (coords as number[][][])[0] ?? [];
      if (ring.length) {
        lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
        lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      }
    }
    if (lon == null || lat == null) continue;
    out.push(
      eventBase({
        id: `gdacs:${props.eventtype}:${props.eventid}`,
        source: "GDACS",
        kind,
        title: props.name || props.description || "GDACS event",
        mag: null,
        alert: asAlert(props.alertlevel, null),
        lat,
        lon,
        time: props.fromdate ? new Date(props.fromdate).toISOString() : new Date().toISOString(),
        url: props.url?.report || "",
        place: props.country || "",
        isoHint: props.affectedcountries?.[0]?.iso2 || "",
        detail: props.severitydata?.severitytext || props.htmldescription || "",
      }),
    );
  }
  return out;
}

async function loadGdacs(): Promise<{ value: DisasterEvent[]; count: number }> {
  const from = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const pages = [1, 2];
  const batches = await Promise.all(
    pages.map(async (page) => {
      const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=FL,TC,VO,WF,DR&alertlevel=green,orange,red&fromdate=${from}&pagenumber=${page}`;
      return parseGdacs(await getText(url, 14000));
    }),
  );
  const merged = new Map<string, DisasterEvent>();
  for (const batch of batches) {
    for (const event of batch) merged.set(event.id, event);
  }
  const value = [...merged.values()];
  return { value, count: value.length };
}

function ringCentroid(coords: unknown, type: string | undefined): { lon: number; lat: number } | null {
  if (type === "Point" && Array.isArray(coords)) {
    const lon = num((coords as number[])[0]);
    const lat = num((coords as number[])[1]);
    return lon == null || lat == null ? null : { lon, lat };
  }
  let ring: number[][] | undefined;
  if (type === "Polygon" && Array.isArray(coords)) ring = (coords as number[][][])[0];
  if (type === "MultiPolygon" && Array.isArray(coords)) ring = (coords as number[][][][])[0]?.[0];
  if (!ring?.length) return null;
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

function parseNws(text: string): DisasterEvent[] {
  const json = JSON.parse(text) as {
    features?: {
      geometry?: { type?: string; coordinates?: unknown } | null;
      properties?: {
        id?: string;
        event?: string;
        headline?: string;
        severity?: string;
        sent?: string;
        effective?: string;
        areaDesc?: string;
        uri?: string;
      };
    }[];
  };
  const out: DisasterEvent[] = [];
  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {};
    const point = ringCentroid(feature.geometry?.coordinates, feature.geometry?.type);
    if (!point || !props.id) continue;
    const severity = (props.severity || "").toLowerCase();
    const alert: AlertLevel =
      severity === "extreme" ? "red" : severity === "severe" ? "orange" : severity === "moderate" ? "green" : "info";
    out.push(
      eventBase({
        id: `nws:${props.id}`,
        source: "NWS" as EventSource,
        kind: "flood",
        title: props.headline || props.event || "Flood alert",
        mag: null,
        alert,
        lat: point.lat,
        lon: point.lon,
        time: props.sent || props.effective || new Date().toISOString(),
        url: props.uri || props.id,
        place: props.areaDesc || "",
        isoHint: "US",
        detail: props.event || "",
      }),
    );
    if (out.length >= 160) break;
  }
  return out;
}

async function loadNws(): Promise<{ value: DisasterEvent[]; count: number }> {
  const url =
    "https://api.weather.gov/alerts/active?event=Flood%20Warning,Flash%20Flood%20Warning,Flood%20Watch,Flash%20Flood%20Watch,Coastal%20Flood%20Warning,Flood%20Advisory";
  const value = parseNws(await getText(url, 14000, { Accept: "application/geo+json" }));
  return { value, count: value.length };
}

function acresOf(event: DisasterEvent): number {
  const match = event.detail.match(/([\d.]+)\s*acres/i);
  return match ? Number(match[1]) : 0;
}

function capFires(events: DisasterEvent[], limit: number): DisasterEvent[] {
  const fires = events.filter((event) => event.kind === "fire").sort((a, b) => acresOf(b) - acresOf(a));
  return [...events.filter((event) => event.kind !== "fire"), ...fires.slice(0, limit)];
}

function nearQuake(lat: number, lon: number, quakes: DisasterEvent[]): boolean {
  return quakes.some((quake) => {
    if (Math.abs(quake.lat - lat) > 1.5 || Math.abs(quake.lon - lon) > 1.5) return false;
    const dLat = quake.lat - lat;
    const dLon = quake.lon - lon;
    return dLat * dLat + dLon * dLon < 1.2;
  });
}

function parseRss(xml: string, source: string, limit: number): Headline[] {
  const chunks = xml.split(/<item[\s>]/i).slice(1, limit + 1);
  const out: Headline[] = [];
  for (const chunk of chunks) {
    const title = decodeXml(chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const link = decodeXml(chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || chunk.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || "");
    const published = decodeXml(chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || "");
    if (!title) continue;
    out.push({ title: title.slice(0, 220), source, url: link.slice(0, 400), published });
  }
  return out;
}

async function loadHeadlines(): Promise<{ value: Headline[]; count: number }> {
  const q = encodeURIComponent("(flood OR earthquake OR wildfire OR cyclone OR landslide OR tsunami OR volcano) when:2d");
  const jobs = await Promise.allSettled([
    getText("https://www.gdacs.org/xml/rss.xml", 10000),
    getText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, 10000),
    getText("https://api.reliefweb.int/v1/disasters?appname=meridian-atlas&limit=15&profile=list&preset=latest", 10000),
  ]);
  const headlines: Headline[] = [];
  if (jobs[0].status === "fulfilled") headlines.push(...parseRss(jobs[0].value, "GDACS", 12));
  if (jobs[1].status === "fulfilled") headlines.push(...parseRss(jobs[1].value, "Google News", 12));
  if (jobs[2].status === "fulfilled") {
    const json = JSON.parse(jobs[2].value) as {
      data?: { fields?: { name?: string; url_alias?: string; url?: string; date?: { created?: string } } }[];
    };
    for (const row of json.data ?? []) {
      const name = row.fields?.name;
      if (!name) continue;
      const alias = row.fields?.url_alias || row.fields?.url || "";
      const url = alias.startsWith("http")
        ? alias
        : alias
          ? `https://reliefweb.int/${alias.replace(/^\//, "")}`
          : "https://reliefweb.int";
      headlines.push({
        title: name.slice(0, 220),
        source: "ReliefWeb",
        url,
        published: row.fields?.date?.created || "",
      });
    }
  }
  const seen = new Set<string>();
  const unique = headlines.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length && jobs.every((job) => job.status === "rejected")) {
    throw new Error("headline feeds failed");
  }
  return { value: unique.slice(0, 36), count: unique.length };
}

function goesStamp(ms: number): string {
  const t = new Date(ms);
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() - (t.getUTCMinutes() % 10));
  return t.toISOString().slice(0, 19) + "Z";
}

async function goesFrame(time: string): Promise<boolean> {
  const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/${time}/GoogleMapsCompatible_Level7/2/1/1.jpg`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function loadClouds(): Promise<{ value: { time: string }; count: number }> {
  const lags = [30, 40, 50, 60, 80, 100, 140, 180];
  const now = Date.now();
  const hits = await Promise.all(
    lags.map(async (lag) => {
      const time = goesStamp(now - lag * 60_000);
      return { lag, time, ok: await goesFrame(time) };
    }),
  );
  const found = hits.filter((hit) => hit.ok).sort((a, b) => a.lag - b.lag)[0];
  if (!found) throw new Error("no GOES frame");
  return { value: { time: found.time }, count: 1 };
}

async function loadRadar(): Promise<{ value: AtlasPayload["radar"]; count: number }> {
  const json = JSON.parse(await getText("https://api.rainviewer.com/public/weather-maps.json", 10000)) as {
    host?: string;
    radar?: { past?: { time: number; path: string }[] };
  };
  if (!json.host || !json.radar?.past?.length) throw new Error("no radar frames");
  const frames = json.radar.past.slice(-8);
  return { value: { host: json.host, frames }, count: frames.length };
}

async function loadPrecip(): Promise<{ value: { id: string; mm: number }[]; count: number }> {
  const chunks: (typeof SAMPLE_POINTS)[] = [];
  for (let i = 0; i < SAMPLE_POINTS.length; i += 50) chunks.push(SAMPLE_POINTS.slice(i, i + 50));
  const rows: { id: string; mm: number }[] = [];
  await Promise.all(
    chunks.map(async (chunk) => {
      const lats = chunk.map((p) => p.lat).join(",");
      const lons = chunk.map((p) => p.lon).join(",");
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&daily=precipitation_sum&past_days=2&forecast_days=2&timezone=UTC`;
      const json = JSON.parse(await getText(url, 14000)) as
        | { daily?: { precipitation_sum?: (number | null)[] } }
        | { daily?: { precipitation_sum?: (number | null)[] } }[];
      const list = Array.isArray(json) ? json : [json];
      list.forEach((row, index) => {
        const point = chunk[index];
        if (!point) return;
        const sums = row.daily?.precipitation_sum ?? [];
        const mm = sums.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
        rows.push({ id: point.id, mm: Math.round(mm * 10) / 10 });
      });
    }),
  );
  const max = new Map<string, number>();
  for (const row of rows) max.set(row.id, Math.max(max.get(row.id) ?? 0, row.mm));
  const value = [...max.entries()].map(([id, mm]) => ({ id, mm }));
  const wet = value.filter((row) => row.mm > 0).length;
  return { value, count: wet };
}

async function loadDonki(nasaKey: string): Promise<{ notes: { title: string; time: string }[]; note: string | null }> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(nasaKey)) return { notes: [], note: "NASA key format was not accepted." };
  const start = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  try {
    const text = await getText(
      `https://api.nasa.gov/DONKI/notifications?startDate=${start}&endDate=${end}&type=all&api_key=${encodeURIComponent(nasaKey)}`,
      10000,
    );
    const json = JSON.parse(text) as { messageType?: string; messageIssueTime?: string; messageBody?: string }[];
    if (!Array.isArray(json)) return { notes: [], note: "DONKI returned an unexpected payload." };
    const notes = json.slice(0, 4).map((row) => ({
      title: strip(`${row.messageType || "Notice"}: ${(row.messageBody || "").split("\n")[0]}`, 180),
      time: row.messageIssueTime || "",
    }));
    return { notes, note: null };
  } catch (err) {
    return { notes: [], note: `NASA DONKI ${failMessage(err)}` };
  }
}

async function loadCanadaQuakes(): Promise<{ value: DisasterEvent[]; count: number }> {
  const start = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const url = `https://www.earthquakescanada.nrcan.gc.ca/fdsnws/event/1/query?format=text&minmagnitude=1.5&orderby=time&limit=300&starttime=${start}`;
  const text = await getText(url, 14000);
  const value: DisasterEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [id, time, latRaw, lonRaw, depth, magType, magRaw, ...placeParts] = line.split("|");
    const lat = num(latRaw);
    const lon = num(lonRaw);
    const mag = num(magRaw);
    if (!id || lat == null || lon == null || mag == null) continue;
    const place = (placeParts.join("|").split("/")[0] || "").trim();
    value.push(
      eventBase({
        id: `canquake:${id}`,
        source: "Earthquakes Canada",
        kind: "quake",
        title: `M ${mag.toFixed(1)} - ${place || "Canada"}`,
        mag: Math.round(mag * 10) / 10,
        alert: asAlert(undefined, mag),
        lat,
        lon,
        time: time || new Date().toISOString(),
        url: "https://www.earthquakescanada.nrcan.gc.ca/recent/index-en.php",
        place,
        isoHint: "CA",
        detail: ["Earthquakes Canada", magType || "", depth ? `Depth ${depth} km` : ""].filter(Boolean).join(" · "),
      }),
    );
  }
  return { value, count: value.length };
}

function canadaAlertKind(name: string): HazardKind | null {
  const n = name.toLowerCase();
  if (/flood|rainfall|heavy rain|storm surge|high water|waterspout/.test(n)) return "flood";
  if (/wildfire|forest fire|fire/.test(n)) return "fire";
  if (/tornado|thunder|wind|hurricane|blizzard|winter|snow|freezing rain|squall|storm/.test(n)) return "storm";
  return null;
}

async function loadCanadaAlerts(): Promise<{ value: DisasterEvent[]; count: number }> {
  const text = await getText("https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=250", 14000);
  const json = JSON.parse(text) as {
    features?: {
      id?: string;
      geometry?: { type?: string; coordinates?: unknown } | null;
      properties?: {
        id?: string;
        alert_name_en?: string;
        alert_type?: string;
        province?: string;
        feature_name_en?: string;
        risk_colour_en?: string;
        publication_datetime?: string;
        alert_short_name_en?: string;
      };
    }[];
  };
  const value: DisasterEvent[] = [];
  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {};
    const name = props.alert_name_en || props.alert_short_name_en || "";
    const kind = canadaAlertKind(name);
    if (!kind) continue;
    const point = ringCentroid(feature.geometry?.coordinates, feature.geometry?.type);
    if (!point) continue;
    const colour = (props.risk_colour_en || "").toLowerCase();
    const type = (props.alert_type || "").toLowerCase();
    let alert: AlertLevel = "green";
    if (colour === "red") alert = "red";
    else if (colour === "orange" || type === "warning") alert = "orange";
    value.push(
      eventBase({
        id: `eccc:${feature.id || props.id || `${point.lon.toFixed(2)},${point.lat.toFixed(2)},${name}`}`,
        source: "ECCC",
        kind,
        title: name || "Canada weather alert",
        mag: null,
        alert,
        lat: point.lat,
        lon: point.lon,
        time: props.publication_datetime || new Date().toISOString(),
        url: "https://weather.gc.ca/warnings/index_e.html",
        place: [props.feature_name_en, props.province].filter(Boolean).join(", "),
        isoHint: "CA",
        detail: `Environment Canada ${props.alert_type || "alert"}`,
      }),
    );
  }
  return { value, count: value.length };
}

function thinCells(events: DisasterEvent[], cell: number, cap: number): DisasterEvent[] {
  const rank = (event: DisasterEvent) => (event.alert === "red" ? 3 : event.alert === "orange" ? 2 : 1);
  const best = new Map<string, DisasterEvent>();
  for (const event of events) {
    const key = `${Math.round(event.lat / cell)}:${Math.round(event.lon / cell)}`;
    const prev = best.get(key);
    if (!prev || rank(event) > rank(prev) || (rank(event) === rank(prev) && event.time > prev.time)) {
      best.set(key, event);
    }
  }
  return [...best.values()].sort((a, b) => rank(b) - rank(a) || b.time.localeCompare(a.time)).slice(0, cap);
}

async function loadCanadaFires(): Promise<{ value: DisasterEvent[]; count: number }> {
  const url =
    "https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=public:hotspots_24h&outputFormat=application/json&maxFeatures=2500";
  const json = JSON.parse(await getText(url, 14000)) as {
    features?: {
      properties?: {
        lat?: number;
        lon?: number;
        rep_date?: string;
        agency?: string;
        satellite?: string;
        fwi?: number;
        frp?: number;
      };
    }[];
  };
  const raw: DisasterEvent[] = [];
  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {};
    const lat = num(props.lat);
    const lon = num(props.lon);
    if (lat == null || lon == null || lat < 41 || lat > 84 || lon < -141 || lon > -52) continue;
    const fwi = num(props.fwi) ?? 0;
    const frp = num(props.frp) ?? 0;
    const alert: AlertLevel = fwi >= 20 || frp >= 40 ? "red" : fwi >= 10 || frp >= 12 ? "orange" : "green";
    raw.push(
      eventBase({
        id: `cwfis:${lat.toFixed(3)},${lon.toFixed(3)},${props.rep_date || ""}`,
        source: "CWFIS",
        kind: "fire",
        title: `Wildfire hotspot${props.agency ? ` · ${props.agency}` : ""}`,
        mag: null,
        alert,
        lat,
        lon,
        time: props.rep_date || new Date().toISOString(),
        url: "https://cwfis.cfs.nrcan.gc.ca/maps/fw",
        place: props.agency || "Canada",
        isoHint: "CA",
        detail: ["Canadian Wildland Fire Information System", fwi ? `FWI ${fwi.toFixed(0)}` : "", frp ? `FRP ${frp.toFixed(0)}` : "", props.satellite || ""]
          .filter(Boolean)
          .join(" · "),
      }),
    );
  }
  const value = thinCells(raw, 0.7, 380);
  return { value, count: value.length };
}

async function fetchAtlas(): Promise<AtlasPayload> {
  const sources: SourceStatus[] = [];
  const [usgs, canadaQuakes, eonet, gdacs, nws, canadaAlerts, canadaFires, radar, clouds, headlines, precip] = await Promise.all([
    timed(sources, "usgs", "USGS quakes", loadUsgs),
    timed(sources, "canquake", "Earthquakes Canada", loadCanadaQuakes),
    timed(sources, "eonet", "NASA EONET", async () => {
      const value = parseEonet(await getText("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=250", 14000));
      return { value, count: value.length };
    }),
    timed(sources, "gdacs", "GDACS", loadGdacs),
    timed(sources, "nws", "NWS floods", loadNws),
    timed(sources, "eccc", "Canada alerts", loadCanadaAlerts),
    timed(sources, "cwfis", "Canada wildfires", loadCanadaFires),
    timed(sources, "radar", "RainViewer", loadRadar),
    timed(sources, "goes", "GOES clouds", loadClouds),
    timed(sources, "wires", "Headlines", loadHeadlines),
    timed(sources, "meteo", "Open-Meteo rain", loadPrecip),
  ]);

  const quakes = usgs ?? [];
  const localQuakes = (canadaQuakes ?? []).filter((event) => !nearQuake(event.lat, event.lon, quakes));
  const eonetEvents = capFires(
    (eonet ?? []).filter((event) => event.kind !== "quake" || !nearQuake(event.lat, event.lon, quakes)),
    70,
  );
  const events = [
    ...quakes,
    ...localQuakes,
    ...eonetEvents,
    ...(gdacs ?? []),
    ...(nws ?? []),
    ...(canadaAlerts ?? []),
    ...(canadaFires ?? []),
  ].slice(0, 1600);
  events.sort((a, b) => b.time.localeCompare(a.time));

  return {
    fetchedAt: new Date().toISOString(),
    events,
    precip: precip ?? [],
    radar: radar ?? null,
    clouds: clouds ?? null,
    headlines: headlines ?? [],
    sources,
    spaceWeather: [],
    nasaNote: null,
  };
}

export async function loadAtlasData(nasaKey: string): Promise<AtlasPayload> {
  const now = Date.now();
  let base: AtlasPayload;
  if (atlasCache && now - atlasCache.at < ATLAS_TTL) {
    base = atlasCache.payload;
  } else {
    base = await fetchAtlas();
    atlasCache = { at: now, payload: base };
  }
  if (!nasaKey) return { ...base, spaceWeather: [], nasaNote: null };
  const donki = await loadDonki(nasaKey);
  return { ...base, spaceWeather: donki.notes, nasaNote: donki.note };
}

function sumDaily(row: { daily?: { precipitation_sum?: (number | null)[] } } | undefined): number | null {
  const sums = row?.daily?.precipitation_sum;
  if (!sums) return null;
  return Math.round(sums.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0) * 10) / 10;
}

export async function loadPointForecast(lat: number, lon: number, owmKey: string): Promise<PointForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m&daily=precipitation_sum&past_days=2&forecast_days=2&timezone=UTC`;
  const text = await getText(url, 10000);
  const json = JSON.parse(text) as {
    current?: {
      temperature_2m?: number;
      precipitation?: number;
      rain?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    daily?: { precipitation_sum?: (number | null)[] };
  };
  const forecast: PointForecast = {
    tempC: num(json.current?.temperature_2m),
    windKmh: num(json.current?.wind_speed_10m),
    rainMm: num(json.current?.rain ?? json.current?.precipitation),
    code: num(json.current?.weather_code),
    precipWindowMm: sumDaily(json),
    place: null,
    owm: null,
    owmError: null,
  };
  if (!owmKey) return forecast;
  if (!/^[A-Za-z0-9]{8,80}$/.test(owmKey)) {
    forecast.owmError = "OpenWeather key format was not accepted.";
    return forecast;
  }
  try {
    const owmText = await getText(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(owmKey)}`,
      10000,
    );
    const owm = JSON.parse(owmText) as {
      name?: string;
      main?: { temp?: number; humidity?: number };
      weather?: { description?: string }[];
      rain?: { "1h"?: number; "3h"?: number };
    };
    forecast.place = owm.name || null;
    forecast.owm = {
      name: owm.name || "",
      tempC: num(owm.main?.temp),
      rain1h: num(owm.rain?.["1h"] ?? owm.rain?.["3h"]),
      description: owm.weather?.[0]?.description || "",
      humidity: num(owm.main?.humidity),
    };
  } catch (err) {
    forecast.owmError = `OpenWeather ${failMessage(err)}`;
  }
  return forecast;
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return out;
}

export async function loadOwmBlend(
  owmKey: string,
  points: { id: string; lat: number; lon: number }[],
): Promise<{ rows: OwmSample[]; error: string | null }> {
  if (!/^[A-Za-z0-9]{8,80}$/.test(owmKey)) return { rows: [], error: "OpenWeather key format was not accepted." };
  const stamp = `${owmKey.slice(0, 4)}:${points.map((p) => p.id).join(",")}`;
  if (owmCache && owmCache.stamp === stamp && Date.now() - owmCache.at < 10 * 60_000) {
    return { rows: owmCache.rows, error: null };
  }
  const sample = points.slice(0, 24).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.id);
  let aborted = "";
  const rows = (
    await pool(sample, 6, async (point) => {
      if (aborted) return null;
      try {
        const text = await getText(
          `https://api.openweathermap.org/data/2.5/weather?lat=${point.lat}&lon=${point.lon}&units=metric&appid=${encodeURIComponent(owmKey)}`,
          10000,
        );
        const json = JSON.parse(text) as {
          weather?: { description?: string }[];
          main?: { temp?: number };
          rain?: { "1h"?: number; "3h"?: number };
        };
        const rain1h = num(json.rain?.["1h"] ?? json.rain?.["3h"]) ?? 0;
        return {
          id: point.id,
          rain1h,
          description: json.weather?.[0]?.description || "",
          tempC: num(json.main?.temp),
        } satisfies OwmSample;
      } catch (err) {
        const message = failMessage(err);
        if (message.includes("401") || message.includes("404")) aborted = message;
        return null;
      }
    })
  ).filter((row): row is OwmSample => row != null);
  if (!rows.length && aborted) return { rows: [], error: `OpenWeather ${aborted}` };
  owmCache = { stamp, at: Date.now(), rows };
  return { rows, error: aborted ? `OpenWeather ${aborted}` : null };
}
