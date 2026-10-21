/**
 * Tile helpers for the 3D globe. Everything is drawn into equirectangular (plate carrée) canvases that wrap a
 * sphere, so EPSG:4326 tiles are stitched directly and Web-Mercator tiles are re-projected row by row.
 * All sources are keyless and send CORS headers (checked 2026-10-21).
 */

export const GIBS_4326 = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best";

/** NASA GIBS EPSG:4326 tiles are 512 px and span 288/2^level degrees (level 0 = 2x1 tiles). */
export function gibsTileDeg(level: number): number {
  return 288 / 2 ** level;
}

export type GibsLayer = { layer: string; time: string; matrix: string; ext: "jpeg" | "jpg" | "png"; maxLevel: number };

export const BLUE_MARBLE: GibsLayer = {
  layer: "BlueMarble_NextGeneration",
  time: "2004-08-01",
  matrix: "500m",
  ext: "jpeg",
  maxLevel: 8,
};

export const BLACK_MARBLE: GibsLayer = {
  layer: "VIIRS_Black_Marble",
  time: "2016-01-01",
  matrix: "500m",
  ext: "png",
  maxLevel: 8,
};

/** Geostationary clean-IR (band 13) every 10 min: Americas (GOES-East/West) and Asia-Pacific (Himawari). */
export const IR_LAYERS: GibsLayer[] = [
  { layer: "GOES-West_ABI_Band13_Clean_Infrared", time: "default", matrix: "2km", ext: "png", maxLevel: 5 },
  { layer: "Himawari_AHI_Band13_Clean_Infrared", time: "default", matrix: "2km", ext: "png", maxLevel: 5 },
  { layer: "GOES-East_ABI_Band13_Clean_Infrared", time: "default", matrix: "2km", ext: "png", maxLevel: 5 },
];

export function gibsUrl(l: GibsLayer, level: number, row: number, col: number): string {
  return `${GIBS_4326}/${l.layer}/default/${l.time}/${l.matrix}/${level}/${row}/${col}.${l.ext}`;
}

/** Copernicus Sentinel-2 cloudless mosaic by EOX (WGS84 grid: 256 px tiles, level 0 = 2x1 tiles of 180°). */
export function eoxS2Url(level: number, row: number, col: number): string {
  return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020/default/WGS84/${level}/${row}/${col}.jpg`;
}

export function loadImage(url: string, timeoutMs = 20000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => {
      img.src = "";
      resolve(null);
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Stitch a whole-world GIBS level into an equirectangular canvas (360°x180°). Tiles below -90° are cropped.
 * `onTile` fires as tiles land so the texture can refresh progressively.
 */
export async function stitchGibsWorld(
  layers: GibsLayer[],
  level: number,
  onTile?: (canvas: HTMLCanvasElement) => void,
): Promise<{ canvas: HTMLCanvasElement; loaded: number }> {
  const deg = gibsTileDeg(level);
  const pxPerDeg = 512 / deg;
  const canvas = makeCanvas(Math.round(360 * pxPerDeg), Math.round(180 * pxPerDeg));
  const ctx = canvas.getContext("2d")!;
  const cols = Math.ceil(360 / deg);
  const rows = Math.ceil(180 / deg);
  let loaded = 0;
  for (const layer of layers) {
    const jobs: Promise<void>[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        jobs.push(
          loadImage(gibsUrl(layer, level, row, col)).then((img) => {
            if (!img) return;
            ctx.drawImage(img, col * 512, row * 512);
            loaded += 1;
            onTile?.(canvas);
          }),
        );
      }
    }
    await Promise.all(jobs);
  }
  return { canvas, loaded };
}

/** Whole-world EOX Sentinel-2 cloudless at a WGS84 level (2^(level+1) x 2^level tiles of 256 px). */
export async function stitchEoxWorld(level: number, onTile?: (canvas: HTMLCanvasElement) => void) {
  const cols = 2 ** (level + 1);
  const rows = 2 ** level;
  const canvas = makeCanvas(cols * 256, rows * 256);
  const ctx = canvas.getContext("2d")!;
  let loaded = 0;
  const jobs: Promise<void>[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      jobs.push(
        loadImage(eoxS2Url(level, row, col)).then((img) => {
          if (!img) return;
          ctx.drawImage(img, col * 256, row * 256);
          loaded += 1;
          onTile?.(canvas);
        }),
      );
    }
  }
  await Promise.all(jobs);
  return { canvas, loaded };
}

/**
 * Web-Mercator XYZ tiles → equirectangular canvas. `template` uses {z}/{x}/{y}. Rows outside ±85.05° stay empty.
 */
export async function stitchMercatorWorld(
  template: string,
  z: number,
  tileSize: number,
  outWidth = 2048,
  wrap: (url: string) => string = (url) => url,
) {
  const n = 2 ** z;
  const merc = makeCanvas(n * tileSize, n * tileSize);
  const mctx = merc.getContext("2d")!;
  let loaded = 0;
  const jobs: Promise<void>[] = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const url = template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
      jobs.push(
        loadImage(wrap(url)).then((img) => {
          if (!img) return;
          mctx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
          loaded += 1;
        }),
      );
    }
  }
  await Promise.all(jobs);
  const out = makeCanvas(outWidth, outWidth / 2);
  const octx = out.getContext("2d")!;
  const H = merc.height;
  for (let row = 0; row < out.height; row += 1) {
    const lat = 90 - ((row + 0.5) / out.height) * 180;
    if (Math.abs(lat) > 85.05) continue;
    const rad = (lat * Math.PI) / 180;
    const my = ((1 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI) / 2) * H;
    octx.drawImage(merc, 0, Math.floor(my), merc.width, 1, 0, row, out.width, 1);
  }
  return { canvas: out, loaded };
}

/** One zoomed-in GIBS tile and the lon/lat box it covers. */
export type TileBox = {
  key: string;
  url: string;
  lon0: number;
  lon1: number;
  /** Clipped to -90 (geometry). */
  lat0: number;
  lat1: number;
  /** Full southern edge of the tile image (texture mapping). */
  texLat0: number;
};

/** GIBS tiles at `level` covering a window of `span` tiles around a lon/lat. */
export function gibsTilesAround(layer: GibsLayer, level: number, lat: number, lon: number, span = 4): TileBox[] {
  const deg = gibsTileDeg(level);
  const cols = Math.ceil(360 / deg);
  const rows = Math.ceil(180 / deg);
  const cc = Math.floor((lon + 180) / deg);
  const cr = Math.floor((90 - lat) / deg);
  const half = Math.floor(span / 2);
  const out: TileBox[] = [];
  for (let r = cr - half; r < cr - half + span; r += 1) {
    if (r < 0 || r >= rows) continue;
    for (let c0 = cc - half; c0 < cc - half + span; c0 += 1) {
      const c = ((c0 % cols) + cols) % cols;
      const lon0 = -180 + c * deg;
      const lat1 = 90 - r * deg;
      if (lon0 >= 180) continue;
      out.push({
        key: `${layer.layer}/${level}/${r}/${c}`,
        url: gibsUrl(layer, level, r, c),
        lon0,
        lon1: lon0 + deg,
        lat1,
        lat0: Math.max(-90, lat1 - deg),
        texLat0: lat1 - deg,
      });
    }
  }
  return out;
}

/** EOX Sentinel-2 cloudless tiles (WGS84, 180/2^level degrees, 256 px) around a lon/lat. */
export function eoxTilesAround(level: number, lat: number, lon: number, span = 4): TileBox[] {
  const deg = 180 / 2 ** level;
  const cols = 2 ** (level + 1);
  const rows = 2 ** level;
  const cc = Math.floor((lon + 180) / deg);
  const cr = Math.floor((90 - lat) / deg);
  const half = Math.floor(span / 2);
  const out: TileBox[] = [];
  for (let r = cr - half; r < cr - half + span; r += 1) {
    if (r < 0 || r >= rows) continue;
    for (let c0 = cc - half; c0 < cc - half + span; c0 += 1) {
      const c = ((c0 % cols) + cols) % cols;
      const lon0 = -180 + c * deg;
      const lat1 = 90 - r * deg;
      out.push({ key: `eox/${level}/${r}/${c}`, url: eoxS2Url(level, r, c), lon0, lon1: lon0 + deg, lat1, lat0: lat1 - deg, texLat0: lat1 - deg });
    }
  }
  return out;
}
