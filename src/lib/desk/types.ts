export type SourceLink = {
  label: string;
  url: string;
  status: "found" | "empty";
  detail: string;
};

export type DeskWeather = {
  tempC: number | null;
  rain: number | null;
  wind: number | null;
  code: number | null;
};

export type DeskBar = { label: string; value: number };

export type DeskDraft = {
  kind: "radar" | "place" | "chart" | "web";
  title: string;
  lat: number | null;
  lon: number | null;
  radiusKm: number | null;
  showRain: boolean;
  showClouds: boolean;
  summary: string;
  pageUrl: string | null;
  weather: DeskWeather | null;
  bars: DeskBar[];
  unit: string;
  sources: SourceLink[];
};

export type DeskWindow = DeskDraft & {
  id: string;
  x: number;
  y: number;
  z: number;
  minimized: boolean;
  pinned: boolean;
};
