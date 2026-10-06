export type HazardKind =
  | "quake"
  | "flood"
  | "fire"
  | "storm"
  | "volcano"
  | "drought"
  | "landslide"
  | "other";

export type AlertLevel = "red" | "orange" | "green" | "info";

export type EventSource = "USGS" | "NASA EONET" | "GDACS" | "NWS" | "Smithsonian" | "Earthquakes Canada" | "CWFIS" | "ECCC";

export type DisasterEvent = {
  id: string;
  source: EventSource;
  kind: HazardKind;
  title: string;
  mag: number | null;
  alert: AlertLevel;
  lat: number;
  lon: number;
  time: string;
  url: string;
  place: string;
  isoHint: string;
  detail: string;
};

export type Headline = {
  title: string;
  source: string;
  url: string;
  published: string;
};

export type SourceStatus = {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  ms: number;
  error: string | null;
};

export type RadarFrame = { time: number; path: string };

export type AtlasPayload = {
  fetchedAt: string;
  events: DisasterEvent[];
  precip: { id: string; mm: number }[];
  radar: { host: string; frames: RadarFrame[] } | null;
  headlines: Headline[];
  sources: SourceStatus[];
  spaceWeather: { title: string; time: string }[];
  nasaNote: string | null;
};

export type Metric = "flood" | "quake" | "fire" | "storm" | "all";

export type CountryProps = {
  id: string;
  name: string;
  iso2: string;
  iso3: string;
  continent: string;
  pop: number;
  lon: number;
  lat: number;
};

export type CountryCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    properties: CountryProps;
    geometry: { type: string; coordinates: unknown };
  }[];
};

export type VolcanoCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: {
      id: string;
      name: string;
      country: string;
      year: number | null;
      kind: string;
      elev: number | null;
    };
  }[];
};

export type AssignedEvent = DisasterEvent & {
  countryId: string;
  countryName: string;
};

export type CountryStat = {
  id: string;
  name: string;
  iso2: string;
  continent: string;
  pop: number;
  lon: number;
  lat: number;
  precipMm: number;
  owmRain: number | null;
  counts: Record<HazardKind, number>;
  maxMag: number;
  maxFloodAlert: AlertLevel;
  score: number;
  eventTotal: number;
  events: AssignedEvent[];
};

export type PointForecast = {
  tempC: number | null;
  windKmh: number | null;
  rainMm: number | null;
  code: number | null;
  precipWindowMm: number | null;
  place: string | null;
  owm: {
    name: string;
    tempC: number | null;
    rain1h: number | null;
    description: string;
    humidity: number | null;
  } | null;
  owmError: string | null;
};

export type OwmSample = { id: string; rain1h: number; description: string; tempC: number | null };

export type AnalystResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

export const METRICS: { id: Metric; label: string; kicker: string; blurb: string }[] = [
  {
    id: "flood",
    label: "Floods",
    kicker: "FLOOD PRESSURE",
    blurb:
      "Open-Meteo rain over the past 2 days and next 2 days, plus GDACS, NASA, and NWS flood reports. Not an official warning.",
  },
  {
    id: "quake",
    label: "Quakes",
    kicker: "SEISMIC FIELD",
    blurb: "USGS magnitude and count. The color is pressure, not a damage estimate.",
  },
  {
    id: "fire",
    label: "Fires",
    kicker: "ACTIVE FIRE",
    blurb: "NASA EONET and GDACS wildfires that are still open.",
  },
  {
    id: "storm",
    label: "Storms",
    kicker: "STORM TRACKS",
    blurb: "GDACS tropical cyclones and NASA severe storms.",
  },
  {
    id: "all",
    label: "All",
    kicker: "ALL HAZARDS",
    blurb: "The stronger of flood, quake, fire, storm, and volcano pressure in each country.",
  },
];

export const KIND_LABEL: Record<HazardKind, string> = {
  quake: "Quake",
  flood: "Flood",
  fire: "Fire",
  storm: "Storm",
  volcano: "Volcano",
  drought: "Drought",
  landslide: "Slide",
  other: "Other",
};
