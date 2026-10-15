/**
 * One weather palette for the whole app: radar tiles are repainted with it in the browser and the
 * legend gradients are built from the same stops, so the legend always matches the map.
 *
 * Radar sources only publish their own colors, so each tile pixel is matched back to its source
 * color table (dBZ + rain/snow), then painted with ours. Tables come from
 * https://www.rainviewer.com/files/rainviewer_api_colors_table.csv (RainViewer's free API only
 * serves "Universal Blue", scheme 2, with snow drawn in separate colors) and the standard NWS
 * reflectivity scale used by NOAA nowCOAST MRMS (no snow flag there, so it is all rain).
 */

export type PrecipKind = "rain" | "snow" | "ice";
type Stop = [number, string];

/** dBZ → color. Rain stays green → yellow → orange → red, so pink stays free for freezing rain and purple for snow. */
export const RAIN_STOPS: Stop[] = [
  [10, "#a5d6a7"],
  [18, "#66bb6a"],
  [25, "#2e7d32"],
  [30, "#c0ca33"],
  [35, "#fdd835"],
  [40, "#fb8c00"],
  [45, "#e53935"],
  [52, "#b71c1c"],
  [60, "#6d0010"],
];

export const SNOW_STOPS: Stop[] = [
  [-10, "#ede7f6"],
  [5, "#d1c4e9"],
  [15, "#b39ddb"],
  [25, "#9575cd"],
  [35, "#7e57c2"],
  [45, "#4527a0"],
];

/** Open-Meteo freezing codes, light → heavy: 56 freezing drizzle, 57 dense, 66 freezing rain, 67 heavy. */
export const ICE_STOPS: Stop[] = [
  [56, "#f8bbd0"],
  [57, "#f48fb1"],
  [66, "#ec407a"],
  [67, "#c2185b"],
];

export const ICE_CODES = [56, 57, 66, 67] as const;

export function legendGradient(kind: PrecipKind): string {
  const stops = kind === "rain" ? RAIN_STOPS : kind === "snow" ? SNOW_STOPS : ICE_STOPS;
  const lo = stops[0][0];
  const span = stops[stops.length - 1][0] - lo || 1;
  return `linear-gradient(90deg, ${stops.map(([at, color]) => `${color} ${Math.round(((at - lo) / span) * 100)}%`).join(", ")})`;
}

function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paint(stops: Stop[], value: number): [number, number, number] {
  if (value <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [at, color] = stops[i];
    if (value <= at) {
      const [prevAt, prevColor] = stops[i - 1];
      const t = (value - prevAt) / (at - prevAt);
      const a = hex(prevColor);
      const b = hex(color);
      return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * t)) as [number, number, number];
    }
  }
  return hex(stops[stops.length - 1][1]);
}

type Entry = { rgb: [number, number, number]; dbz: number; snow: boolean };

function entries(list: string, snow: boolean): Entry[] {
  return list.split(" ").map((item) => {
    const [dbz, color] = item.split(":");
    return { rgb: hex(`#${color}`), dbz: Number(dbz), snow };
  });
}

// RainViewer "Universal Blue" rain (dBZ:RRGGBB). Below 10 dBZ it draws faint tan haze (noise/drizzle).
const RV_RAIN = entries(
  "-10:636159 -5:726e61 0:827b69 5:928871 8:b6a97e 10:cec087 12:d6c88f 14:ded097 15:88ddee 16:6cd1eb 17:51c5e8 18:36bae5 19:1baee2 20:00a3e0 21:009ad5 22:0091ca 23:0088bf 24:007fb4 25:0077aa 26:0070a3 27:00699c 28:006295 29:005b8e 30:005588 31:005180 32:004e78 33:004a70 34:004768 35:ffee00 36:ffe000 37:ffd200 38:ffc500 39:ffb700 40:ffaa00 41:ff9f00 42:ff9500 43:ff8b00 44:ff8100 45:ff4400 46:f23600 47:e62800 48:d91b00 49:cd0d00 50:c10000 51:a80000 52:8f0000 53:760000 54:5d0000 55:ffaaff 57:ff95ff 59:ff81ff 61:ff6cff 63:ff58ff 64:ff4eff 65:ffffff 75:00ff00",
  false,
);

// RainViewer "Universal Blue" snow: pale cyan (low dBZ fades in by alpha) → deep blue.
const RV_SNOW = entries(
  "-10:cfffff 0:c7ffff 10:bfffff 11:b8f8ff 12:b2f2ff 13:abebff 14:a5e5ff 15:9fdfff 16:98d8ff 17:92d2ff 18:8bcbff 19:85c5ff 20:7fbfff 21:78b8ff 22:72b2ff 23:6babff 24:65a5ff 25:5f9fff 26:5b9bff 27:5898ff 28:5595ff 29:5292ff 30:4f8fff 32:4888ff 34:4282ff 36:3b7bff 38:3575ff 40:2f6fff 42:2868ff 44:2262ff 46:1b5bff 48:1555ff 50:0f4fff 55:003fff 60:002fff 65:001fff 70:000fff 75:0000ff",
  true,
);

// NWS reflectivity scale (nowCOAST MRMS), both the classic NWS and NEXRAD Level III shades.
const NWS_RAIN = entries(
  "5:04e9e7 10:019ff4 10:009cf7 15:0300f4 15:0000f7 20:02fd02 20:00ff00 25:01c501 25:03b703 30:008e00 30:087305 35:fdf802 35:ffff00 40:e5bc00 40:ecce00 45:fd9500 45:fe9300 50:fd0000 50:ff0000 55:d40000 55:bd0000 60:bc0000 65:f800fd 65:fe00fe 70:9854c6 70:9c52c6 75:fdfdfd",
  false,
);

const TABLES = { rainviewer: [...RV_RAIN, ...RV_SNOW], noaa: NWS_RAIN };
export type RadarSource = keyof typeof TABLES;

// Pixels farther than this from every source color (anti-aliased edges, labels) are left transparent.
const MAX_DIST2 = 70 * 70;
const RAIN_MIN_DBZ = 10;
const cache = { rainviewer: new Map<number, number>(), noaa: new Map<number, number>() };

/** Repaint one RGBA pixel from a source radar palette into ours. Returns packed 0xRRGGBBAA (0 = transparent). */
export function recolorPixel(source: RadarSource, r: number, g: number, b: number, a: number): number {
  if (a < 8) return 0;
  const key = ((r << 24) | (g << 16) | (b << 8) | (a >> 4)) >>> 0;
  const memo = cache[source].get(key);
  if (memo !== undefined) return memo;
  let best: Entry | null = null;
  let bestD = Infinity;
  for (const entry of TABLES[source]) {
    const d = (entry.rgb[0] - r) ** 2 + (entry.rgb[1] - g) ** 2 + (entry.rgb[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  let out = 0;
  if (best && bestD <= MAX_DIST2) {
    if (best.snow) {
      // Low-dBZ snow keeps one color and fades in by alpha (alpha ≈ (dBZ + 10) × 12.75).
      const dbz = best.dbz < 10 ? Math.min(9, a / 12.75 - 10) : best.dbz;
      const [rr, gg, bb] = paint(SNOW_STOPS, dbz);
      out = pack(rr, gg, bb, Math.round(255 * Math.min(1, 0.45 + (dbz + 10) / 30)));
    } else if (best.dbz >= RAIN_MIN_DBZ) {
      const [rr, gg, bb] = paint(RAIN_STOPS, best.dbz);
      out = pack(rr, gg, bb, best.dbz < 18 ? 170 : 255);
    }
  }
  cache[source].set(key, out);
  return out;
}

function pack(r: number, g: number, b: number, a: number): number {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

/** Repaint a whole RGBA buffer in place. */
export function recolorImage(source: RadarSource, data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const out = recolorPixel(source, data[i], data[i + 1], data[i + 2], data[i + 3]);
    data[i] = out >>> 24;
    data[i + 1] = (out >>> 16) & 255;
    data[i + 2] = (out >>> 8) & 255;
    data[i + 3] = out & 255;
  }
}
