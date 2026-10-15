export type SeriesPoint = { t: string; v: number | null };

export type LegendInfo = { min: number; max: number; units: string; gradient: string[] };

export type PointReport = {
  at: string;
  lat: number;
  lon: number;
  day: string;
  /** Today's value of each active ocean layer (null on land / no data). */
  ocean: { id: string; value: number | null }[];
  /** Daily sea temperature and wave height, 3 days back to 8 days ahead. */
  sst: SeriesPoint[];
  waves: SeriesPoint[];
  /** ECMWF forecast (Copernicus partner model) via Open-Meteo. */
  rain: { bins: SeriesPoint[]; daily: SeriesPoint[]; snowDaily: SeriesPoint[] } | null;
  /** Copernicus Atmosphere Monitoring Service (CAMS). */
  air: { pm25: SeriesPoint[]; ozone: SeriesPoint[]; dust: SeriesPoint[]; uv: SeriesPoint[] } | null;
  /** Copernicus Emergency Management Service GloFAS river discharge. */
  river: { discharge: SeriesPoint[]; mean: SeriesPoint[]; max: SeriesPoint[] } | null;
  errors: string[];
};
