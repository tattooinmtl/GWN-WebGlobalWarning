import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker, RasterTileSource } from "maplibre-gl";
import { setBase, watchBase } from "@/lib/atlas/basemap";
import { LAYERS, tileTemplate, type LayerSettings } from "@/lib/copernicus/layers";
import { protocolTiles, registerCmemsProtocol } from "@/lib/copernicus/protocol";

const PREFIX = "cm-";

type Props = {
  settings: Record<string, LayerSettings>;
  day: string;
  depth: number;
  point: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
  /** Called whenever the visible ocean layers finish loading (used to pace playback). */
  onIdle: () => void;
};

export function CmemsMap({ settings, day, depth, point, onPick, onIdle }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const pickRef = useRef(onPick);
  const idleRef = useRef(onIdle);
  const [ready, setReady] = useState(false);
  pickRef.current = onPick;
  idleRef.current = onIdle;

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    let dead = false;
    let map: MlMap | null = null;
    let watch: ResizeObserver | null = null;

    void (async () => {
      const maplibregl = await import("maplibre-gl");
      const workerMod = await import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url");
      if (dead || !wrapRef.current) return;
      maplibregl.setWorkerUrl(workerMod.default);
      registerCmemsProtocol(maplibregl);
      libRef.current = maplibregl;
      const narrow = wrapRef.current.clientWidth < 800;
      map = new maplibregl.Map({
        container: wrapRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": "#04121c" } }],
        },
        center: [-40, 30],
        zoom: narrow ? 1 : 1.8,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        maxZoom: 9,
        minZoom: 0.6,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Data © Copernicus Marine Service" }), "bottom-left");
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      mapRef.current = map;
      watch = new ResizeObserver(() => map?.resize());
      watch.observe(wrapRef.current);
      map.on("error", (event) => {
        if (event.error?.message) console.warn(event.error.message);
      });
      map.on("load", () => {
        if (dead || !map) return;
        setBase(map, 0);
        watchBase(map);
        setReady(true);
        map.resize();
      });
      map.on("idle", () => idleRef.current());
      map.on("click", (event) => pickRef.current(event.lngLat.lat, ((event.lngLat.lng + 540) % 360) - 180));
    })();

    return () => {
      dead = true;
      setReady(false);
      watch?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep one raster source per active layer, in catalogue order (later layers draw on top).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const layer of LAYERS) {
      const id = PREFIX + layer.id;
      const config = settings[layer.id];
      if (!config?.on) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
        continue;
      }
      const url = protocolTiles(tileTemplate(layer, config, day, depth));
      const source = map.getSource(id) as RasterTileSource | undefined;
      if (!source) {
        map.addSource(id, {
          type: "raster",
          tiles: [url],
          tileSize: 256,
          maxzoom: 8,
          attribution: "Copernicus Marine",
        });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": config.opacity, "raster-fade-duration": 0 } });
      } else {
        if (source.tiles?.[0] !== url) source.setTiles([url]);
        map.setPaintProperty(id, "raster-opacity", config.opacity);
      }
    }
    // Re-stack so the order always follows the catalogue.
    for (const layer of LAYERS) {
      const id = PREFIX + layer.id;
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }, [ready, settings, day, depth]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const dot = document.createElement("div");
      dot.className = "cm-pin";
      markerRef.current = new lib.Marker({ element: dot });
    }
    markerRef.current.setLngLat([point.lon, point.lat]).addTo(map);
  }, [ready, point]);

  return <div ref={wrapRef} className="map-stage absolute inset-0" />;
}
