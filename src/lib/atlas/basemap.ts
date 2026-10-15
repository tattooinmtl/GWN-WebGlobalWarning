import type { Map as MlMap } from "maplibre-gl";

// Base imagery, in fallback order: Esri while prototyping, then free NASA Blue Marble, then free OSM streets.
const BASEMAPS = [
  {
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    maxzoom: 12,
    attribution: "Imagery © Esri",
    brightness: 0.72,
  },
  {
    tiles: [
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    ],
    maxzoom: 8,
    attribution: "Imagery © NASA Blue Marble (GIBS)",
    brightness: 0.72,
  },
  {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    maxzoom: 12,
    attribution: "© OpenStreetMap contributors",
    brightness: 0.55,
  },
];

// Tile errors in a row (no tile loaded in between) before moving to the next basemap.
const BASE_FAIL_LIMIT = 6;

export function setBase(map: MlMap, index: number) {
  const base = BASEMAPS[index];
  if (map.getLayer("sat")) map.removeLayer("sat");
  if (map.getSource("sat")) map.removeSource("sat");
  map.addSource("sat", {
    type: "raster",
    tiles: base.tiles,
    tileSize: 256,
    maxzoom: base.maxzoom,
    attribution: base.attribution,
  });
  map.addLayer(
    {
      id: "sat",
      type: "raster",
      source: "sat",
      paint: {
        "raster-opacity": 0.78,
        "raster-saturation": -0.2,
        "raster-contrast": 0.12,
        "raster-brightness-max": base.brightness,
      },
    },
    // Keep imagery at the bottom (just above "bg") so clouds/radar stay on top after a swap.
    map.getStyle().layers[1]?.id,
  );
}

export function watchBase(map: MlMap) {
  let index = 0;
  let fails = 0;
  map.on("sourcedata", (event) => {
    if (event.sourceId === "sat" && event.tile) fails = 0;
  });
  map.on("error", (event) => {
    if ((event as { sourceId?: string }).sourceId !== "sat" || index >= BASEMAPS.length - 1) return;
    fails += 1;
    if (fails < BASE_FAIL_LIMIT) return;
    index += 1;
    fails = 0;
    console.warn(`Basemap tiles failing, switching to: ${BASEMAPS[index].attribution}`);
    setBase(map, index);
  });
}

