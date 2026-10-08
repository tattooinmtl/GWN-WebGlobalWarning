import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FilterSpecification, GeoJSONSource, Map as MlMap, RasterTileSource } from "maplibre-gl";
import { kindWeight } from "@/lib/disasters/aggregate";
import { ago } from "@/lib/disasters/format";
import { circleRing } from "@/lib/disasters/geo";
import type { AssignedEvent, CountryCollection, CountryStat, HazardKind, VolcanoCollection } from "@/lib/disasters/types";
import { KIND_LABEL } from "@/lib/disasters/types";
import type { LayerPrefs, UserLocation } from "@/lib/atlas/store";
import { mergeLayers, useAtlas } from "@/lib/atlas/store";

const EMPTY = {
  type: "FeatureCollection" as const,
  features: [] as {
    type: "Feature";
    id?: string;
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }[],
};

const KIND_COLOR: Record<HazardKind, string> = {
  quake: "#e23b4a",
  flood: "#3ec6ff",
  fire: "#ff8a2a",
  storm: "#b9a6ff",
  volcano: "#f5c518",
  drought: "#c4a574",
  landslide: "#d2c0a0",
  other: "#e8eef6",
};

type Props = {
  geo: CountryCollection | null;
  countries: CountryStat[];
  events: AssignedEvent[];
  volcanoes: VolcanoCollection | null;
  radar: { host: string; frames: { time: number; path: string }[] } | null;
  clouds: { time: string } | null;
  frame: number;
  layers: LayerPrefs;
  owmKey: string;
  radiusKm: number;
  location: UserLocation | null;
};

function volcanoStatus(year: number | null, eruptingNow: boolean): "erupting" | "restless" | "dormant" {
  if (eruptingNow) return "erupting";
  if (year == null) return "dormant";
  const now = new Date().getFullYear();
  if (year >= now - 1) return "erupting";
  if (year >= now - 50) return "restless";
  return "dormant";
}

export function HazardMap(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  const hoverRef = useRef("");
  const pickRef = useRef<string | null>(null);
  const eventPickRef = useRef<string | null>(null);
  const tagKey = useRef("");
  propsRef.current = props;
  const [ready, setReady] = useState(false);
  const fly = useAtlas((s) => s.flyRequest);
  const zoomNonce = useAtlas((s) => s.zoomNonce);
  const selectedIso = useAtlas((s) => s.selectedIso);
  const selectedEventId = useAtlas((s) => s.selectedEventId);

  function placeTags() {
    const map = mapRef.current;
    const host = tagsRef.current;
    if (!map || !host) return;
    const width = map.getContainer().clientWidth;
    const height = map.getContainer().clientHeight;
    for (const node of host.querySelectorAll("button")) {
      const point = map.project([Number(node.dataset.lon), Number(node.dataset.lat)]);
      const visible = point.x > 8 && point.y > 92 && point.x < width - 8 && point.y < height - 80;
      node.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -130%)`;
      node.style.display = visible ? "block" : "none";
    }
  }

  function rebuildTags() {
    const host = tagsRef.current;
    if (!host) return;
    const top = propsRef.current.countries.filter((c) => c.score >= 0.22).slice(0, 8);
    const key = top
      .map((c) => `${c.id}:${Math.round(c.score * 20)}:${c.maxFloodAlert === "red" || c.maxMag >= 7}`)
      .join(",");
    if (key === tagKey.current) return;
    tagKey.current = key;
    host.replaceChildren();
    for (const country of top) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hazard-tag";
      button.dataset.hot = country.maxFloodAlert === "red" || country.maxMag >= 7 ? "true" : "false";
      button.dataset.lon = String(country.lon);
      button.dataset.lat = String(country.lat);
      button.textContent = country.name;
      button.addEventListener("click", () => {
        const state = useAtlas.getState();
        state.setSelectedIso(country.id);
        state.requestFly(country.lon, country.lat, 4.2);
        if (window.matchMedia("(max-width: 767px)").matches) state.setSheet("places");
      });
      host.append(button);
    }
  }

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
      const narrow = wrapRef.current.clientWidth < 800;
      map = new maplibregl.Map({
        container: wrapRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": "#070b12" } }],
        },
        center: [8, 16],
        zoom: narrow ? 1.05 : 1.55,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        maxZoom: 12,
        minZoom: 0.8,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
      mapRef.current = map;
      watch = new ResizeObserver(() => map?.resize());
      watch.observe(wrapRef.current);
      map.on("error", (event) => {
        if (event.error?.message) console.warn(event.error.message);
      });
      map.on("load", () => {
        if (dead || !map) return;
        addBase(map);
        setReady(true);
        map.resize();
      });
      map.on("mousemove", (event) => onMove(map!, event.point.x, event.point.y));
      map.on("mouseout", () => clearHover(map!));
      map.on("click", (event) => onClick(map!, event.point.x, event.point.y));
      map.on("move", () => placeTags());
    })();

    return () => {
      dead = true;
      setReady(false);
      watch?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !props.geo) return;
    const scores = new Map(props.countries.map((country) => [country.id, country.score]));
    const features = props.geo.features.map((feature) => {
      const id = String(feature.id ?? feature.properties.id);
      return {
        ...feature,
        id,
        properties: { ...feature.properties, score: scores.get(id) ?? 0 },
      };
    });
    (map.getSource("countries") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    } as Parameters<GeoJSONSource["setData"]>[0]);
    if (pickRef.current && pickRef.current !== selectedIso) {
      map.setFeatureState({ source: "countries", id: pickRef.current }, { picked: false });
    }
    if (selectedIso) map.setFeatureState({ source: "countries", id: selectedIso }, { picked: true });
    pickRef.current = selectedIso;
    rebuildTags();
    placeTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.geo, props.countries, selectedIso]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const features = props.events.map((event) => ({
      type: "Feature" as const,
      id: event.id,
      properties: {
        id: event.id,
        kind: event.kind,
        weight: kindWeight(event.kind, event.mag, event.alert),
        color: KIND_COLOR[event.kind],
        countryId: event.countryId,
        title: event.title,
      },
      geometry: { type: "Point" as const, coordinates: [event.lon, event.lat] },
    }));
    (map.getSource("events") as GeoJSONSource).setData({ type: "FeatureCollection", features });
    if (eventPickRef.current && eventPickRef.current !== selectedEventId) {
      map.setFeatureState({ source: "events", id: eventPickRef.current }, { selected: false });
    }
    if (selectedEventId) map.setFeatureState({ source: "events", id: selectedEventId }, { selected: true });
    eventPickRef.current = selectedEventId;
  }, [ready, props.events, selectedEventId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let dead = false;
    void fetch("/geo/faults.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Fault catalog failed");
        return res.json();
      })
      .then((data) => {
        if (dead) return;
        const source = mapRef.current?.getSource("faults") as GeoJSONSource | undefined;
        source?.setData(data);
      })
      .catch((err) => console.warn(err instanceof Error ? err.message : "Fault catalog failed"));
    return () => {
      dead = true;
    };
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const live = props.events.filter((event) => event.kind === "volcano");
    const features = (props.volcanoes?.features ?? []).map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const eruptingNow = live.some(
        (event) => Math.abs(event.lon - lon) < 0.45 && Math.abs(event.lat - lat) < 0.45,
      );
      return {
        type: "Feature" as const,
        properties: {
          ...feature.properties,
          status: volcanoStatus(feature.properties.year, eruptingNow),
        },
        geometry: feature.geometry,
      };
    });
    (map.getSource("volcanoes") as GeoJSONSource).setData({ type: "FeatureCollection", features });
  }, [ready, props.volcanoes, props.events]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer("events-circle")) return;
    const layers = mergeLayers(props.layers);
    const kinds = [
      layers.quakes && "quake",
      layers.floods && "flood",
      layers.fires && "fire",
      layers.storms && "storm",
      layers.volcanoes && "volcano",
      layers.other && "drought",
      layers.other && "landslide",
      layers.other && "other",
    ].filter((kind): kind is string => Boolean(kind));
    const filter = ["in", ["get", "kind"], ["literal", kinds]] as FilterSpecification;
    map.setFilter("events-circle", filter);
    map.setFilter("events-glow", filter);
    map.setLayoutProperty("countries-fill", "visibility", layers.choropleth ? "visible" : "none");
    if (map.getLayer("faults-active")) {
      map.setLayoutProperty("faults-active", "visibility", layers.faultsActive ? "visible" : "none");
    }
    if (map.getLayer("faults-dormant")) {
      map.setLayoutProperty("faults-dormant", "visibility", layers.faultsDormant ? "visible" : "none");
    }
    const volcanoVis = layers.volcanoes ? "visible" : "none";
    if (map.getLayer("volcano-dot")) map.setLayoutProperty("volcano-dot", "visibility", volcanoVis);
    if (map.getLayer("volcano-glow")) map.setLayoutProperty("volcano-glow", "visibility", volcanoVis);
  }, [ready, props.layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const radius = map.getSource("radius") as GeoJSONSource;
    const user = map.getSource("user") as GeoJSONSource;
    if (!props.location || !props.layers.radius) {
      radius.setData(EMPTY);
      user.setData(EMPTY);
      return;
    }
    radius.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [circleRing(props.location.lon, props.location.lat, props.radiusKm)],
          },
        },
      ],
    });
    user.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [props.location.lon, props.location.lat] },
        },
      ],
    });
  }, [ready, props.location, props.radiusKm, props.layers.radius]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer("countries-fill")) return;
    const cloudTime = props.clouds?.time ?? "";
    const cloudsOn = Boolean(props.layers.clouds && cloudTime);
    syncRaster(
      map,
      "clouds-west",
      "Clouds © NOAA/NASA GOES",
      cloudsOn,
      cloudTime ? goesTiles("GOES-West_ABI_GeoColor", cloudTime) : null,
      0.92,
      7,
    );
    syncRaster(
      map,
      "clouds-east",
      "",
      cloudsOn,
      cloudTime ? goesTiles("GOES-East_ABI_GeoColor", cloudTime) : null,
      0.92,
      7,
    );
    syncRaster(map, "radar", "Radar © RainViewer", props.layers.radar, radarUrl(props.radar, props.frame), 0.55);
    if (map.getLayer("radar") && map.getLayer("clouds-east")) map.moveLayer("clouds-east", "radar");
    if (map.getLayer("clouds-east") && map.getLayer("clouds-west")) map.moveLayer("clouds-west", "clouds-east");
    if (map.getLayer("countries-fill") && props.layers.choropleth) {
      map.setPaintProperty("countries-fill", "fill-opacity", cloudsOn ? 0.22 : countryFillOpacity);
    }
  }, [ready, props.radar, props.frame, props.layers.radar, props.layers.clouds, props.layers.choropleth, props.clouds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer("countries-fill")) return;
    const tiles =
      props.layers.owmTiles && props.owmKey
        ? [`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(props.owmKey)}`]
        : null;
    syncRaster(map, "owm", "Precip © OpenWeather", Boolean(tiles), tiles, 0.62);
  }, [ready, props.layers.owmTiles, props.owmKey]);

  useEffect(() => {
    if (!ready || !zoomNonce || !mapRef.current) return;
    const delta = useAtlas.getState().zoomBy;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current.zoomTo(mapRef.current.getZoom() + delta, { duration: reduce ? 0 : 220 });
  }, [ready, zoomNonce]);

  useEffect(() => {
    if (!ready || !fly || !mapRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current.flyTo({
      center: [fly.lon, fly.lat],
      zoom: fly.zoom,
      duration: reduce ? 0 : 1100,
      essential: true,
    });
  }, [ready, fly]);

  function onMove(map: MlMap, x: number, y: number) {
    const tip = tipRef.current;
    if (!tip || !map.getLayer("events-circle")) return;
    const hitEvent = map.queryRenderedFeatures([x, y], { layers: ["events-circle"] })[0];
    const hitVolcano = map.getLayer("volcano-dot")
      ? map.queryRenderedFeatures([x, y], { layers: ["volcano-dot"] })[0]
      : undefined;
    const hitFault =
      map.getLayer("faults-active") && map.getLayer("faults-dormant")
        ? map.queryRenderedFeatures(
            [
              [x - 6, y - 6],
              [x + 6, y + 6],
            ],
            { layers: ["faults-active", "faults-dormant"] },
          )[0]
        : undefined;
    const hitCountry = map.queryRenderedFeatures([x, y], { layers: ["countries-fill"] })[0];
    const eventId = hitEvent ? String(hitEvent.properties?.id ?? "") : "";
    const volcanoId = hitVolcano ? String(hitVolcano.properties?.id ?? "") : "";
    const faultName = hitFault ? String(hitFault.properties?.n || hitFault.properties?.s || "Fault") : "";
    const iso = hitCountry ? String(hitCountry.id ?? hitCountry.properties?.id ?? "") : "";
    tip.style.transform = `translate(${x + 14}px, ${y + 16}px)`;
    const key = `${eventId}|${volcanoId}|${faultName}|${iso}`;
    if (key !== hoverRef.current) {
      const prev = hoverRef.current.split("|")[3];
      if (prev) map.setFeatureState({ source: "countries", id: prev }, { hover: false });
      hoverRef.current = key;
      if (iso && !eventId && !volcanoId && !faultName) map.setFeatureState({ source: "countries", id: iso }, { hover: true });
      fillTip(tip, eventId, iso, hitVolcano?.properties, hitFault?.properties);
    }
    tip.hidden = !eventId && !volcanoId && !faultName && !iso;
    map.getCanvas().style.cursor = eventId || volcanoId || faultName || iso ? "pointer" : "";
  }

  function clearHover(map: MlMap) {
    if (tipRef.current) tipRef.current.hidden = true;
    const prev = hoverRef.current.split("|")[3];
    if (prev && map.getLayer("countries-fill")) map.setFeatureState({ source: "countries", id: prev }, { hover: false });
    hoverRef.current = "";
  }

  function hideCard() {
    if (cardRef.current) cardRef.current.hidden = true;
  }

  function showCard(x: number, y: number, heading: string, lines: { label: string; value: string }[]) {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap) return;
    card.replaceChildren();
    const head = document.createElement("div");
    head.className = "flex items-start justify-between gap-2";
    const title = document.createElement("p");
    title.className = "font-medium leading-snug";
    title.textContent = heading;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "shrink-0 text-muted";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close info");
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      hideCard();
    });
    head.append(title, close);
    card.append(head);
    for (const line of lines) {
      if (!line.value) continue;
      const row = document.createElement("p");
      row.className = "mt-1 text-xs leading-snug";
      const name = document.createElement("span");
      name.className = "text-muted";
      name.textContent = line.label;
      row.append(name, document.createTextNode(` ${line.value}`));
      card.append(row);
    }
    const left = Math.max(8, Math.min(x + 14, wrap.clientWidth - 236));
    const top = Math.max(8, Math.min(y + 14, wrap.clientHeight - 196));
    card.style.transform = `translate(${left}px, ${top}px)`;
    card.hidden = false;
  }

  function onClick(map: MlMap, x: number, y: number) {
    if (!map.getLayer("events-circle")) return;
    const hitEvent = map.queryRenderedFeatures([x, y], { layers: ["events-circle"] })[0];
    const hitVolcano = map.getLayer("volcano-dot")
      ? map.queryRenderedFeatures([x, y], { layers: ["volcano-dot"] })[0]
      : undefined;
    const hitCountry = map.queryRenderedFeatures([x, y], { layers: ["countries-fill"] })[0];
    const state = useAtlas.getState();
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    if (hitEvent) {
      const event = propsRef.current.events.find((item) => item.id === String(hitEvent.properties?.id ?? ""));
      state.setSelectedEventId(String(hitEvent.properties?.id ?? ""));
      const iso = String(hitEvent.properties?.countryId ?? "");
      if (iso) state.setSelectedIso(iso);
      if (event) {
        showCard(x, y, event.place || event.title, [
          { label: "Type", value: KIND_LABEL[event.kind] },
          { label: "Magnitude", value: event.mag != null ? String(event.mag) : "" },
          { label: "Alert", value: event.alert },
          { label: "Source", value: event.source },
          { label: "When", value: ago(event.time) },
          { label: "Where", value: event.countryName || "" },
        ]);
      }
      if (narrow) state.setSheet("places");
      return;
    }
    if (hitVolcano) {
      const volcano = hitVolcano.properties ?? {};
      const year = volcano.year == null || volcano.year === "" ? null : Number(volcano.year);
      const when = year == null || Number.isNaN(year) ? "undated" : year < 0 ? `${Math.abs(year)} BCE` : String(year);
      showCard(x, y, String(volcano.name || "Volcano"), [
        { label: "Type", value: String(volcano.kind || volcano.status || "Volcano") },
        { label: "Status", value: String(volcano.status || "") },
        { label: "Location", value: String(volcano.country || "") },
        { label: "Last eruption", value: when },
        { label: "Elevation", value: volcano.elev ? `${volcano.elev} m` : "" },
      ]);
      if (hitVolcano.geometry.type === "Point") {
        const [lon, lat] = hitVolcano.geometry.coordinates as [number, number];
        state.requestFly(lon, lat, 5.2);
      }
      return;
    }
    const hitFault =
      map.getLayer("faults-active") && map.getLayer("faults-dormant")
        ? map.queryRenderedFeatures(
            [
              [x - 6, y - 6],
              [x + 6, y + 6],
            ],
            { layers: ["faults-active", "faults-dormant"] },
          )[0]
        : undefined;
    if (hitFault) {
      const fault = hitFault.properties ?? {};
      const active = fault.c === "a";
      showCard(x, y, String(fault.n || "Unnamed fault"), [
        { label: "Type", value: active ? "Active fault" : "Dormant fault" },
        { label: "Style", value: String(fault.s || "") },
      ]);
      return;
    }
    hideCard();
    if (hitCountry) {
      state.setSelectedIso(String(hitCountry.id ?? hitCountry.properties?.id ?? ""));
      state.setSelectedEventId(null);
      if (narrow) state.setSheet("places");
    }
  }

  function fillTip(
    tip: HTMLDivElement,
    eventId: string,
    iso: string,
    volcano?: Record<string, unknown> | null,
    fault?: Record<string, unknown> | null,
  ) {
    tip.replaceChildren();
    const event = propsRef.current.events.find((item) => item.id === eventId);
    const country = propsRef.current.countries.find((item) => item.id === iso);
    const title = document.createElement("p");
    title.className = "font-medium";
    const meta = document.createElement("p");
    meta.className = "mt-1 text-xs text-muted";
    if (event) {
      title.textContent = event.title;
      meta.textContent = `${KIND_LABEL[event.kind]} · ${event.source}${event.mag != null ? ` · M${event.mag}` : ""}`;
      tip.append(title, meta);
      return;
    }
    if (volcano && volcano.name) {
      const status = String(volcano.status || "dormant");
      const year = volcano.year == null || volcano.year === "" ? null : Number(volcano.year);
      title.textContent = String(volcano.name);
      const when = year == null ? "no dated eruption" : year < 0 ? `${Math.abs(year)} BCE` : String(year);
      meta.textContent = `${status} · last eruption ${when}${volcano.country ? ` · ${volcano.country}` : ""}`;
      tip.append(title, meta);
      return;
    }
    if (fault) {
      const active = fault.c === "a";
      title.textContent = String(fault.n || "Unnamed fault");
      meta.textContent = `${active ? "Active fault" : "Dormant fault"}${fault.s ? ` · ${fault.s}` : ""}`;
      tip.append(title, meta);
      return;
    }
    if (country) {
      title.className = "font-display text-lg leading-none tracking-wide";
      title.textContent = country.name;
      meta.textContent = `Pressure ${Math.round(country.score * 100)} · rain ${country.precipMm.toFixed(0)} mm · ${country.eventTotal} events`;
      tip.append(title, meta);
    }
  }

  return (
    <div
      ref={wrapRef}
      className="map-stage absolute inset-0"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      role="application"
      aria-label="World hazard map"
    >
      <div ref={tagsRef} className="pointer-events-none absolute inset-0 z-10 [&>button]:pointer-events-auto" />
      <div
        ref={cardRef}
        hidden
        className="absolute left-0 top-0 z-30 w-56 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream shadow-lg"
      />
      <div
        ref={tipRef}
        hidden
        className="pointer-events-none absolute left-0 top-0 z-20 max-w-64 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream shadow-lg"
      />
    </div>
  );
}

function addBase(map: MlMap) {
  map.addSource("sat", {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 12,
    attribution: "Imagery © Esri",
  });
  map.addLayer({
    id: "sat",
    type: "raster",
    source: "sat",
    paint: {
      "raster-opacity": 0.78,
      "raster-saturation": -0.2,
      "raster-contrast": 0.12,
      "raster-brightness-max": 0.72,
    },
  });
  map.addSource("countries", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "countries-fill",
    type: "fill",
    source: "countries",
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "score"], 0],
        0,
        "#163044",
        0.2,
        "#0e6e8c",
        0.4,
        "#1c8cff",
        0.58,
        "#7a3cff",
        0.76,
        "#e23b4a",
        1,
        "#f5c518",
      ],
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "score"], 0],
        0,
        0.18,
        0.18,
        0.45,
        0.5,
        0.62,
        1,
        0.82,
      ],
    },
  });
  map.addLayer({
    id: "countries-line",
    type: "line",
    source: "countries",
    paint: {
      "line-color": [
        "case",
        ["boolean", ["feature-state", "picked"], false],
        "#f5c518",
        ["boolean", ["feature-state", "hover"], false],
        "#e8eef6",
        "#9fb4c8",
      ],
      "line-width": [
        "case",
        ["boolean", ["feature-state", "picked"], false],
        1.8,
        ["boolean", ["feature-state", "hover"], false],
        1.2,
        0.55,
      ],
      "line-opacity": 0.85,
    },
  });
  map.addSource("faults", {
    type: "geojson",
    data: EMPTY,
    attribution: "Faults © GEM Global Active Faults (CC-BY-SA)",
  });
  map.addLayer({
    id: "faults-dormant",
    type: "line",
    source: "faults",
    filter: ["==", ["get", "c"], "d"],
    paint: {
      "line-color": "#9aa8b8",
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 6, 1.8],
      "line-opacity": 0.7,
      "line-dasharray": [1.1, 0.9],
    },
  });
  map.addLayer({
    id: "faults-active",
    type: "line",
    source: "faults",
    filter: ["==", ["get", "c"], "a"],
    paint: {
      "line-color": "#e7a23a",
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 6, 2.2],
      "line-opacity": 0.82,
    },
  });
  map.addSource("volcanoes", {
    type: "geojson",
    data: EMPTY,
    attribution: "Volcanoes © Smithsonian GVP",
  });
  map.addLayer({
    id: "volcano-glow",
    type: "circle",
    source: "volcanoes",
    filter: ["==", ["get", "status"], "erupting"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 8, 6, 16],
      "circle-color": "#f5c518",
      "circle-blur": 0.8,
      "circle-opacity": 0.45,
    },
  });
  map.addLayer({
    id: "volcano-dot",
    type: "circle",
    source: "volcanoes",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        1,
        ["match", ["get", "status"], "erupting", 4.5, "restless", 3, 1.6],
        6,
        ["match", ["get", "status"], "erupting", 8, "restless", 6, 3.5],
      ],
      "circle-color": ["match", ["get", "status"], "erupting", "#f5c518", "restless", "#ff8a2a", "#8ea0b3"],
      "circle-stroke-color": "#070b12",
      "circle-stroke-width": ["match", ["get", "status"], "dormant", 0, 1],
      "circle-opacity": ["match", ["get", "status"], "dormant", 0.72, 0.95],
    },
  });
  map.addSource("radius", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "radius-fill",
    type: "fill",
    source: "radius",
    paint: { "fill-color": "#f5c518", "fill-opacity": 0.08 },
  });
  map.addLayer({
    id: "radius-line",
    type: "line",
    source: "radius",
    paint: { "line-color": "#f5c518", "line-width": 1.4, "line-dasharray": [1.4, 1.2] },
  });
  map.addSource("events", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "events-glow",
    type: "circle",
    source: "events",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["*", ["get", "weight"], 1.1], 6, ["*", ["get", "weight"], 2.4]],
      "circle-color": ["get", "color"],
      "circle-blur": 0.75,
      "circle-opacity": 0.45,
    },
  });
  map.addLayer({
    id: "events-circle",
    type: "circle",
    source: "events",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["*", ["get", "weight"], 0.55], 6, ["*", ["get", "weight"], 1.35]],
      "circle-color": ["get", "color"],
      "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#f5c518", "#070b12"],
      "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1],
      "circle-opacity": 0.95,
    },
  });
  map.addSource("user", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "user-dot",
    type: "circle",
    source: "user",
    paint: {
      "circle-radius": 6,
      "circle-color": "#f5c518",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#070b12",
    },
  });
}

function goesTiles(layer: string, time: string): string[] {
  return [
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.jpg`,
  ];
}

const countryFillOpacity = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "score"], 0],
  0,
  0.18,
  0.18,
  0.45,
  0.5,
  0.62,
  1,
  0.82,
] as const;

function radarUrl(radar: { host: string; frames: { path: string }[] } | null, frame: number): string[] | null {
  if (!radar?.frames.length) return null;
  const path = radar.frames[frame % radar.frames.length]?.path;
  if (!path) return null;
  return [`${radar.host}${path}/256/{z}/{x}/{y}/2/1_1.png`];
}

function syncRaster(
  map: MlMap,
  id: string,
  attribution: string,
  show: boolean,
  tiles: string[] | null,
  opacity: number,
  maxzoom?: number,
) {
  if (show && tiles) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: "raster", tiles, tileSize: 256, attribution, ...(maxzoom ? { maxzoom } : {}) });
      map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": opacity } }, "countries-fill");
    } else {
      (map.getSource(id) as RasterTileSource).setTiles(tiles);
      map.setPaintProperty(id, "raster-opacity", opacity);
      map.setLayoutProperty(id, "visibility", "visible");
    }
  } else if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", "none");
  }
}
