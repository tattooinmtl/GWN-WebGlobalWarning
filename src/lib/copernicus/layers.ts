/**
 * Copernicus Marine layers served by the free, keyless WMTS at wmts.marine.copernicus.eu.
 * Ids are `PRODUCT/DATASET_TAG/VARIABLE`; the dataset tag (e.g. `_202406`) changes on a Copernicus
 * service release, so when a layer stops loading, check the product's "Data access" page.
 */

export const CMEMS_WMTS = "https://wmts.marine.copernicus.eu/teroWmts";

export type GroupId = "temperature" | "currents" | "salinity" | "waves" | "ice" | "life";

export type CmemsLayer = {
  id: string;
  group: GroupId;
  label: string;
  /** product/dataset/variable */
  layer: string;
  unit: string;
  /** Default color map and value range (from the service's own GetLegend). */
  cmap: string;
  range: [number, number];
  /** Daily means are stamped per day; waves every 3 h. */
  step: "day" | "3h";
  /** Has a depth dimension. */
  depth?: boolean;
  /** Vector layer: arrows can be drawn over the speed. */
  vector?: boolean;
  /** Logarithmic colour scale (values spanning orders of magnitude). */
  log?: boolean;
  /** Show values with this many decimals. */
  digits: number;
  hint: string;
};

export const GROUPS: { id: GroupId; label: string; icon: string }[] = [
  { id: "temperature", label: "Temperature", icon: "🌡" },
  { id: "currents", label: "Currents & sea level", icon: "🌀" },
  { id: "salinity", label: "Salinity", icon: "🧂" },
  { id: "waves", label: "Waves", icon: "🌊" },
  { id: "ice", label: "Sea ice", icon: "❄️" },
  { id: "life", label: "Ocean life & chemistry", icon: "🌱" },
];

const PHY = "GLOBAL_ANALYSISFORECAST_PHY_001_024";
const WAV = "GLOBAL_ANALYSISFORECAST_WAV_001_027/cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411";
const BGC = "GLOBAL_ANALYSISFORECAST_BGC_001_028";

export const LAYERS: CmemsLayer[] = [
  {
    id: "sst",
    group: "temperature",
    label: "Sea temperature",
    layer: `${PHY}/cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_202406/thetao`,
    unit: "°C",
    cmap: "thermal",
    range: [-2, 32],
    step: "day",
    depth: true,
    digits: 1,
    hint: "Daily mean water temperature, 1/12° model.",
  },
  {
    id: "sst-anomaly",
    group: "temperature",
    label: "Temperature anomaly",
    layer: `${PHY}/cmems_mod_glo_phy_anfc_0.083deg-sst-anomaly_P1D-m_202411/sea_surface_temperature_anomaly`,
    unit: "°C",
    cmap: "balance",
    range: [-4, 4],
    step: "day",
    digits: 1,
    hint: "How much warmer (red) or colder (blue) the surface is than normal.",
  },
  {
    id: "currents",
    group: "currents",
    label: "Currents",
    layer: `${PHY}/cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m_202406/sea_water_velocity`,
    unit: "m/s",
    cmap: "speed",
    range: [0, 1.2],
    step: "day",
    depth: true,
    vector: true,
    digits: 2,
    hint: "Speed of the water; turn on arrows to see the direction.",
  },
  {
    id: "sea-level",
    group: "currents",
    label: "Sea level",
    layer: `${PHY}/cmems_mod_glo_phy_anfc_0.083deg_P1D-m_202406/zos`,
    unit: "m",
    cmap: "balance",
    range: [-1.5, 1.5],
    step: "day",
    digits: 2,
    hint: "Sea surface height above the geoid (storm surges, eddies).",
  },
  {
    id: "mixed-layer",
    group: "currents",
    label: "Mixed layer depth",
    layer: `${PHY}/cmems_mod_glo_phy_anfc_0.083deg_P1D-m_202406/mlotst`,
    unit: "m",
    cmap: "plasma",
    range: [10, 200],
    step: "day",
    digits: 0,
    hint: "How deep the well-stirred surface layer goes.",
  },
  {
    id: "salinity",
    group: "salinity",
    label: "Salinity",
    layer: `${PHY}/cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m_202406/so`,
    unit: "PSU",
    cmap: "haline",
    range: [30, 37],
    step: "day",
    depth: true,
    digits: 1,
    hint: "Salt content (practical salinity units).",
  },
  {
    id: "wave-height",
    group: "waves",
    label: "Wave height",
    layer: `${WAV}/VHM0`,
    unit: "m",
    cmap: "amp",
    range: [0, 8],
    step: "3h",
    digits: 1,
    hint: "Significant wave height (average of the highest third).",
  },
  {
    id: "swell",
    group: "waves",
    label: "Swell height",
    layer: `${WAV}/VHM0_SW1`,
    unit: "m",
    cmap: "amp",
    range: [0, 6],
    step: "3h",
    digits: 1,
    hint: "Primary swell: long waves from distant storms.",
  },
  {
    id: "wave-max",
    group: "waves",
    label: "Max wave height",
    layer: `${WAV}/VCMX`,
    unit: "m",
    cmap: "amp",
    range: [0, 14],
    step: "3h",
    digits: 1,
    hint: "Highest expected crest-to-trough wave.",
  },
  {
    id: "wave-period",
    group: "waves",
    label: "Wave period",
    layer: `${WAV}/VTPK`,
    unit: "s",
    cmap: "tempo",
    range: [2, 18],
    step: "3h",
    digits: 0,
    hint: "Seconds between wave crests at the spectral peak.",
  },
  {
    id: "ice-cover",
    group: "ice",
    label: "Ice cover",
    layer: `${PHY}/cmems_mod_glo_phy_anfc_0.083deg_P1D-m_202406/siconc`,
    unit: "%",
    cmap: "ice",
    range: [0, 1],
    step: "day",
    digits: 0,
    hint: "Fraction of the sea covered by ice.",
  },
  {
    id: "ice-thickness",
    group: "ice",
    label: "Ice thickness",
    layer: `${PHY}/cmems_mod_glo_phy_anfc_0.083deg_P1D-m_202406/sithick`,
    unit: "m",
    cmap: "ice",
    range: [0, 4],
    step: "day",
    digits: 1,
    hint: "Sea ice thickness.",
  },
  {
    id: "chlorophyll",
    group: "life",
    label: "Chlorophyll",
    layer: `${BGC}/cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m_202311/chl`,
    unit: "mg/m³",
    cmap: "algae",
    range: [0.01, 10],
    step: "day",
    log: true,
    digits: 2,
    hint: "Phytoplankton (algae) in the water; blooms show bright.",
  },
  {
    id: "oxygen",
    group: "life",
    label: "Oxygen",
    layer: `${BGC}/cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m_202311/o2`,
    unit: "mmol/m³",
    cmap: "dense",
    range: [150, 350],
    step: "day",
    digits: 0,
    hint: "Dissolved oxygen; low values stress marine life.",
  },
  {
    id: "ph",
    group: "life",
    label: "Acidity (pH)",
    layer: `${BGC}/cmems_mod_glo_bgc-car_anfc_0.25deg_P1D-m_202311/ph`,
    unit: "pH",
    cmap: "matter",
    range: [7.9, 8.2],
    step: "day",
    digits: 2,
    hint: "Ocean acidification: lower pH is more acidic.",
  },
];

export const LAYER_BY_ID = new Map(LAYERS.map((layer) => [layer.id, layer]));

/** Copernicus colour maps (cmocean set) accepted by the WMTS `cmap:` style. */
export const CMAPS = ["thermal", "balance", "speed", "haline", "amp", "ice", "algae", "dense", "matter", "tempo", "solar", "viridis", "plasma", "inferno", "cividis", "rainbow"] as const;

/** NEMO model depth levels (m) used by the PHY datasets; the WMTS wants the exact level, negative. */
export const DEPTHS = [0.494025, 9.572997, 29.44473, 47.37369, 92.32607, 155.8507, 266.0403, 541.0889, 1062.44, 2225.078] as const;

export type LayerSettings = {
  on: boolean;
  opacity: number;
  cmap: string;
  range: [number, number];
  /** Hide values outside the range instead of clamping them to the end colors. */
  onlyInRange: boolean;
  arrows: boolean;
};

export function defaultSettings(layer: CmemsLayer): LayerSettings {
  return {
    on: layer.id === "sst",
    opacity: 0.85,
    cmap: layer.cmap,
    range: layer.range,
    onlyInRange: false,
    arrows: false,
  };
}

/** Days offered on the time slider, relative to today (UTC). The forecast runs ~9 days ahead. */
export const DAY_OFFSETS = Array.from({ length: 17 }, (_, i) => i - 7);

export function dayStamp(offset: number, now = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  return day.toISOString().slice(0, 10);
}

/** WMTS `time` for a layer on a given day: daily means at 00:00 UTC, 3-hourly waves at noon. */
export function layerTime(layer: CmemsLayer, day: string): string {
  return layer.step === "3h" ? `${day}T12:00:00Z` : `${day}T00:00:00Z`;
}

export function styleString(layer: CmemsLayer, settings: LayerSettings): string {
  const parts = [`cmap:${settings.cmap}`, `range:${settings.range[0]}/${settings.range[1]}`];
  if (settings.onlyInRange) parts.push("noClamp");
  if (layer.log) parts.push("logScale");
  if (layer.vector) parts.push(`vectorStyle:${settings.arrows ? "solidAndVector" : "solid"}`);
  return parts.join(",");
}

function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value.startsWith("{") ? value : encodeURIComponent(value)}`)
    .join("&");
}

function dims(layer: CmemsLayer, day: string, depth: number): Record<string, string> {
  const out: Record<string, string> = { time: layerTime(layer, day) };
  if (layer.depth) out.elevation = String(-depth);
  return out;
}

/** MapLibre tile template for a layer ({z}/{x}/{y} are filled in by MapLibre). */
export function tileTemplate(layer: CmemsLayer, settings: LayerSettings, day: string, depth: number): string {
  return `${CMEMS_WMTS}?${query({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: layer.layer,
    STYLE: styleString(layer, settings),
    FORMAT: "image/png",
    TILEMATRIXSET: "EPSG:3857",
    TILEMATRIX: "{z}",
    TILEROW: "{y}",
    TILECOL: "{x}",
    ...dims(layer, day, depth),
  })}`;
}

/** Web-Mercator tile + pixel holding a lon/lat, for WMTS GetFeatureInfo. */
export function tilePixel(lon: number, lat: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const col = Math.min(n - 1, Math.floor(x));
  const row = Math.min(n - 1, Math.floor(y));
  return { col, row, i: Math.min(255, Math.floor((x - col) * 256)), j: Math.min(255, Math.floor((y - row) * 256)) };
}

export function featureInfoUrl(layerId: string, lon: number, lat: number, time: string, depth?: number): string {
  const zoom = 8;
  const { col, row, i, j } = tilePixel(lon, lat, zoom);
  const params: Record<string, string> = {
    SERVICE: "WMTS",
    REQUEST: "GetFeatureInfo",
    VERSION: "1.0.0",
    LAYER: layerId,
    TILEMATRIXSET: "EPSG:3857",
    TILEMATRIX: String(zoom),
    TILEROW: String(row),
    TILECOL: String(col),
    I: String(i),
    J: String(j),
    INFOFORMAT: "application/json",
    time,
  };
  if (depth !== undefined) params.elevation = String(-depth);
  return `${CMEMS_WMTS}?${query(params)}`;
}

export function legendUrl(layer: CmemsLayer, settings: LayerSettings): string {
  return `${CMEMS_WMTS}?${query({
    SERVICE: "WMTS",
    REQUEST: "GetLegend",
    LAYER: layer.layer,
    STYLE: styleString(layer, settings),
    FORMAT: "application/json",
  })}`;
}

/** Only this host may be fetched through our tile proxy. */
export function isCmemsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "wmts.marine.copernicus.eu";
  } catch {
    return false;
  }
}

export function formatValue(layer: CmemsLayer, value: number): string {
  const shown = layer.unit === "%" ? value * 100 : value;
  return `${shown.toFixed(layer.digits)} ${layer.unit}`;
}
