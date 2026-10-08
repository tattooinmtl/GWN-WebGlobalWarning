import { i as __toESM } from "../_runtime.mjs";
import { a as require_react, i as require_jsx_runtime, n as QueryClientProvider, r as useQueryClient, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as Plus, c as MessageSquare, d as Layers, f as Globe, g as ArrowLeft, h as ChartColumn, i as RefreshCw, l as Map$1, m as CloudRain, o as Pin, p as Crosshair, r as Settings, s as Minus, t as X, u as LocateFixed } from "../_libs/lucide-react.mjs";
import { n as APP_TITLE } from "./router-BG7y88WT.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CL7mdL5T.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function cleanKey(value, max) {
	if (typeof value !== "string") return "";
	return value.trim().slice(0, max);
}
var loadAtlas = createServerFn({ method: "POST" }).validator((input) => ({ nasaKey: cleanKey(input?.nasaKey, 80) })).handler(createSsrRpc("ec41fa023681aa3f1c4ba78e7a8c9992c151a8c92049f40b3dcf9cd5c82d6be8"));
var pointForecast = createServerFn({ method: "POST" }).validator((input) => {
	const lat = Number(input?.lat);
	const lon = Number(input?.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Bad coordinates");
	return {
		lat,
		lon,
		owmKey: cleanKey(input?.owmKey, 80)
	};
}).handler(createSsrRpc("0ddf41afaeebcd1a69115050ea2b887d0809cf7d9496e7ff77da4de726156030"));
var blendOpenWeather = createServerFn({ method: "POST" }).validator((input) => {
	const points = Array.isArray(input?.points) ? input.points.slice(0, 24) : [];
	return {
		owmKey: cleanKey(input?.owmKey, 80),
		points: points.map((point) => ({
			id: cleanKey(point?.id, 12),
			lat: Number(point?.lat),
			lon: Number(point?.lon)
		})).filter((point) => point.id && Number.isFinite(point.lat) && Number.isFinite(point.lon))
	};
}).handler(createSsrRpc("454cccdcfeb040d1f3a9242fce4e5725a0a6ca28328133503d6799ed2bec4920"));
var askAnalyst = createServerFn({ method: "POST" }).validator((input) => {
	let mode = "chat";
	if (input?.mode === "scan" || input?.mode === "refine") mode = input.mode;
	const messages = Array.isArray(input?.messages) ? input.messages.slice(-8) : [];
	return {
		minimaxKey: cleanKey(input?.minimaxKey, 200),
		context: typeof input?.context === "string" ? input.context.slice(0, 7500) : "",
		mode,
		messages: messages.filter((message) => message?.role === "user" || message?.role === "assistant").map((message) => ({
			role: message.role,
			content: String(message.content ?? "").slice(0, 1800)
		})).filter((message) => message.content)
	};
}).handler(createSsrRpc("c38c8e9e18bd233369150c48d6ed2e252e6e7c9f08b0419c964ca455e68461f8"));
var openDeskView = createServerFn({ method: "POST" }).validator((input) => {
	const bars = (Array.isArray(input?.bars) ? input.bars : []).slice(0, 8).map((bar) => ({
		label: cleanKey(bar?.label, 40),
		value: Number(bar?.value)
	})).filter((bar) => bar.label && Number.isFinite(bar.value));
	const lat = Number(input?.centerLat);
	const lon = Number(input?.centerLon);
	return {
		question: cleanKey(input?.question, 400),
		place: cleanKey(input?.place, 120) || null,
		wantRadar: input?.wantRadar === true,
		wantClouds: input?.wantClouds === true,
		wantRain: input?.wantRain === true,
		wantChart: input?.wantChart === true,
		wantWeb: input?.wantWeb === true,
		bars,
		unit: cleanKey(input?.unit, 40),
		centerLat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
		centerLon: Number.isFinite(lon) && Math.abs(lon) <= 180 ? lon : null
	};
}).handler(createSsrRpc("b981a0b191d0a2ad9b5ebc9fd77a261776544e08991b69d93b27d77c12c495b7"));
function ago(iso) {
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) return "";
	const s = Math.max(0, Date.now() - t) / 1e3;
	if (s < 90) return "just now";
	if (s < 3600) return `${Math.round(s / 60)}m ago`;
	if (s < 86400) return `${Math.round(s / 3600)}h ago`;
	return `${Math.round(s / 86400)}d ago`;
}
function compactPop(n) {
	if (!Number.isFinite(n) || n <= 0) return "—";
	if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
	if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
	return String(Math.round(n));
}
function weatherText(code) {
	if (code == null) return "Weather unavailable";
	if (code === 0) return "Clear";
	if (code <= 3) return "Cloudy";
	if (code <= 48) return "Fog";
	if (code <= 57) return "Drizzle";
	if (code <= 67) return "Rain";
	if (code <= 77) return "Snow";
	if (code <= 82) return "Showers";
	if (code <= 86) return "Snow showers";
	if (code <= 99) return "Thunderstorm";
	return "Weather";
}
function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n));
}
function stampKey(key) {
	let h = 0;
	for (let i = 0; i < key.length; i++) h = h * 33 + key.charCodeAt(i) >>> 0;
	return key ? `${key.length}:${h.toString(16)}` : "";
}
var EMPTY_COUNTS = () => ({
	quake: 0,
	flood: 0,
	fire: 0,
	storm: 0,
	volcano: 0,
	drought: 0,
	landslide: 0,
	other: 0
});
function haversineKm(lat1, lon1, lat2, lon2) {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a1 = lat1 * Math.PI / 180;
	const a2 = lat2 * Math.PI / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function circleRing(lon, lat, km, steps = 72) {
	const R = 6371;
	const φ1 = lat * Math.PI / 180;
	const λ1 = lon * Math.PI / 180;
	const δ = km / R;
	const ring = [];
	for (let i = 0; i <= steps; i++) {
		const θ = i / steps * 2 * Math.PI;
		const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
		const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
		ring.push([(λ2 * 180 / Math.PI + 540) % 360 - 180, φ2 * 180 / Math.PI]);
	}
	return ring;
}
function pointInRing(lon, lat, ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0];
		const yi = ring[i][1];
		const xj = ring[j][0];
		const yj = ring[j][1];
		if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi || 1e-12) + xi) inside = !inside;
	}
	return inside;
}
function outers(geometry) {
	if (geometry.type === "Polygon") {
		const ring = geometry.coordinates[0];
		return ring ? [ring.map((p) => [p[0], p[1]])] : [];
	}
	if (geometry.type === "MultiPolygon") return geometry.coordinates.map((poly) => poly[0]).filter(Boolean).map((ring) => ring.map((p) => [p[0], p[1]]));
	return [];
}
function prepareCountries(fc) {
	const prep = [];
	for (const feature of fc.features) {
		const p = feature.properties;
		const rings = outers(feature.geometry);
		if (!rings.length || !p?.id) continue;
		let minLon = 180;
		let minLat = 90;
		let maxLon = -180;
		let maxLat = -90;
		for (const ring of rings) for (const [lon, lat] of ring) {
			if (lon < minLon) minLon = lon;
			if (lat < minLat) minLat = lat;
			if (lon > maxLon) maxLon = lon;
			if (lat > maxLat) maxLat = lat;
		}
		const wide = maxLon - minLon > 180;
		prep.push({
			id: p.id,
			name: p.name,
			iso2: p.iso2 || p.id,
			continent: p.continent,
			pop: p.pop,
			lon: p.lon,
			lat: p.lat,
			bbox: [
				minLon,
				minLat,
				maxLon,
				maxLat
			],
			wide,
			rings
		});
	}
	prep.sort((a, b) => {
		return (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
	});
	return prep;
}
function locateCountry(prep, lon, lat) {
	for (const country of prep) {
		if (!country.wide) {
			const [minLon, minLat, maxLon, maxLat] = country.bbox;
			if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
		}
		for (const ring of country.rings) if (pointInRing(lon, lat, ring)) return country;
	}
	return null;
}
var ALERT_RANK = {
	info: 0,
	green: 1,
	orange: 2,
	red: 3
};
function strongerAlert(a, b) {
	return ALERT_RANK[a] >= ALERT_RANK[b] ? a : b;
}
function emptyStat(c, precipMm, owmRain) {
	return {
		id: c.id,
		name: c.name,
		iso2: c.iso2,
		continent: c.continent,
		pop: c.pop,
		lon: c.lon,
		lat: c.lat,
		precipMm,
		owmRain,
		counts: EMPTY_COUNTS(),
		maxMag: 0,
		maxFloodAlert: "info",
		score: 0,
		eventTotal: 0,
		events: []
	};
}
function floodScore(c) {
	const rain = clamp(c.precipMm / 80, 0, 1);
	const owm = c.owmRain == null ? 0 : clamp(c.owmRain / 12, 0, 1);
	const alert = c.maxFloodAlert === "red" ? .5 : c.maxFloodAlert === "orange" ? .32 : c.maxFloodAlert === "green" ? .14 : 0;
	const hits = clamp(c.counts.flood * .18 + alert, 0, 1);
	return clamp(Math.max(rain, owm) * .72 + hits * .62, 0, 1);
}
function quakeScore(c) {
	if (c.counts.quake === 0) return 0;
	const magPart = clamp((c.maxMag - 3.1) / 4.4, 0, 1);
	const countPart = clamp(c.counts.quake / 10, 0, 1);
	return clamp(magPart * .86 + countPart * .22, 0, 1);
}
function countScore(n, div) {
	return clamp(n / div, 0, 1);
}
function scoreCountry(c, metric) {
	const flood = floodScore(c);
	const quake = quakeScore(c);
	const fire = countScore(c.counts.fire, 3);
	const storm = clamp(c.counts.storm * .42, 0, 1);
	const volcano = clamp(c.counts.volcano * .55, 0, 1);
	if (metric === "flood") return flood;
	if (metric === "quake") return quake;
	if (metric === "fire") return fire;
	if (metric === "storm") return storm;
	const parts = [
		flood,
		quake,
		fire,
		storm,
		volcano
	].sort((a, b) => b - a);
	return clamp(parts[0] * .84 + parts[1] * .26, 0, 1);
}
function eventRank(e) {
	return (e.alert === "red" ? 300 : e.alert === "orange" ? 200 : e.alert === "green" ? 90 : 30) + (e.mag ?? 0) * 18;
}
function buildAtlasModel(prep, events, precip, metric, owm, ai) {
	const rain = new Map(precip.map((p) => [p.id, p.mm]));
	const byId = /* @__PURE__ */ new Map();
	const byIso = /* @__PURE__ */ new Map();
	for (const c of prep) {
		const stat = emptyStat(c, rain.get(c.id) ?? 0, owm[c.id] ?? null);
		byId.set(c.id, stat);
		byIso.set(c.iso2.toUpperCase(), stat);
		byIso.set(c.id.toUpperCase(), stat);
	}
	const assigned = [];
	for (const event of events) {
		const found = (event.isoHint ? byIso.get(event.isoHint.toUpperCase()) : void 0) ?? locateCountry(prep, event.lon, event.lat);
		const countryId = found?.id ?? "";
		const countryName = found?.name ?? "";
		const row = {
			...event,
			countryId,
			countryName
		};
		assigned.push(row);
		if (!found) continue;
		const stat = byId.get(found.id);
		if (!stat) continue;
		stat.counts[event.kind] += 1;
		stat.eventTotal += 1;
		if (event.kind === "quake" && (event.mag ?? 0) > stat.maxMag) stat.maxMag = event.mag ?? 0;
		if (event.kind === "flood") stat.maxFloodAlert = strongerAlert(stat.maxFloodAlert, event.alert);
		stat.events.push(row);
	}
	const countries = [];
	for (const stat of byId.values()) {
		stat.events.sort((a, b) => eventRank(b) - eventRank(a) || b.time.localeCompare(a.time));
		stat.events = stat.events.slice(0, 14);
		let score = scoreCountry(stat, metric);
		if (ai && ai.metric === metric) {
			const adj = ai.values[stat.id] ?? ai.values[stat.name];
			if (typeof adj === "number") score = clamp(score * .6 + adj / 100 * .4, 0, 1);
		}
		stat.score = score;
		countries.push(stat);
	}
	countries.sort((a, b) => b.score - a.score || b.eventTotal - a.eventTotal || a.name.localeCompare(b.name));
	return {
		countries,
		events: assigned
	};
}
function topCountries(countries, limit = 18) {
	return countries.filter((c) => c.score > .04 || c.eventTotal > 0).slice(0, limit);
}
function kindWeight(kind, mag, alert) {
	if (kind === "quake") return Math.max(2.4, mag ?? 2.4);
	if (alert === "red") return 7;
	if (alert === "orange") return 5.5;
	return 4.2;
}
var METRICS = [
	{
		id: "flood",
		label: "Floods",
		kicker: "FLOOD PRESSURE",
		blurb: "Open-Meteo rain over the past 2 days and next 2 days, plus GDACS, NASA, and NWS flood reports. Not an official warning."
	},
	{
		id: "quake",
		label: "Quakes",
		kicker: "SEISMIC FIELD",
		blurb: "USGS magnitude and count. The color is pressure, not a damage estimate."
	},
	{
		id: "fire",
		label: "Fires",
		kicker: "ACTIVE FIRE",
		blurb: "NASA EONET and GDACS wildfires that are still open."
	},
	{
		id: "storm",
		label: "Storms",
		kicker: "STORM TRACKS",
		blurb: "GDACS tropical cyclones and NASA severe storms."
	},
	{
		id: "all",
		label: "All",
		kicker: "ALL HAZARDS",
		blurb: "The stronger of flood, quake, fire, storm, and volcano pressure in each country."
	}
];
var KIND_LABEL = {
	quake: "Quake",
	flood: "Flood",
	fire: "Fire",
	storm: "Storm",
	volcano: "Volcano",
	drought: "Drought",
	landslide: "Slide",
	other: "Other"
};
function buildContext(args) {
	const metric = METRICS.find((m) => m.id === args.metric);
	const lines = [];
	lines.push(`Updated ${args.payload.fetchedAt}. Active color metric: ${args.metric}. ${metric?.blurb ?? ""}`);
	lines.push("Sources: " + args.payload.sources.map((s) => `${s.label} ${s.ok ? "ok " + s.count : "FAILED " + (s.error ?? "")}`).join("; "));
	if (args.location) lines.push(`User location (${args.location.label}): ${args.location.lat.toFixed(2)}, ${args.location.lon.toFixed(2)}. Alert radius ${args.radiusKm} km.`);
	else lines.push("User location: not shared.");
	if (args.nearby.length) lines.push("Inside radius: " + args.nearby.slice(0, 6).map((n) => `${n.kind} ${n.mag != null ? "M" + n.mag + " " : ""}${n.title} ${Math.round(n.km)}km [${n.source}]`).join(" | "));
	else if (args.location) lines.push("Inside radius: no matching hazards in the current feeds.");
	const top = args.countries.filter((c) => c.score > .05 || c.eventTotal > 0).slice(0, 10);
	lines.push("Top countries: " + (top.length ? top.map((c) => `${c.name} id=${c.id} pressure=${Math.round(c.score * 100)} rain48hish=${c.precipMm.toFixed(1)}mm` + (c.owmRain != null ? ` owm1h=${c.owmRain.toFixed(1)}mm` : "") + ` floods=${c.counts.flood} quakes=${c.counts.quake} maxMag=${c.maxMag || 0} fires=${c.counts.fire} storms=${c.counts.storm} volcanoes=${c.counts.volcano}`).join(" || ") : "none"));
	if (args.selected) {
		const c = args.selected;
		lines.push(`Selected: ${c.name} id=${c.id} ${c.continent} pressure=${Math.round(c.score * 100)} rain=${c.precipMm.toFixed(1)}mm events=${c.eventTotal}. ` + c.events.slice(0, 6).map((e) => `${e.kind} ${e.mag != null ? "M" + e.mag + " " : ""}${e.title} [${e.source}] ${ago(e.time)}`).join(" | "));
	}
	const hottest = [...args.payload.events].sort((a, b) => (b.alert === "red" ? 1 : 0) - (a.alert === "red" ? 1 : 0) || (b.mag ?? 0) - (a.mag ?? 0)).slice(0, 12);
	lines.push("Notable events: " + hottest.map((e) => `${e.kind}/${e.alert} ${e.mag != null ? "M" + e.mag + " " : ""}${e.title} @${e.lat.toFixed(1)},${e.lon.toFixed(1)} [${e.source}] ${ago(e.time)}`).join(" | "));
	if (args.payload.headlines.length) lines.push("Headlines: " + args.payload.headlines.slice(0, 12).map((h) => `${h.title} (${h.source})`).join(" | "));
	if (args.payload.spaceWeather.length) lines.push("NASA DONKI: " + args.payload.spaceWeather.map((s) => s.title).join(" | "));
	return lines.join("\n").slice(0, 7500);
}
function parseLayerScores(text, countries) {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	let parsed;
	try {
		parsed = JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") return null;
	const body = parsed;
	const raw = body.scores;
	if (!raw || typeof raw !== "object") return null;
	const byId = new Map(countries.map((c) => [c.id.toLowerCase(), c.id]));
	const byName = new Map(countries.map((c) => [c.name.toLowerCase(), c.id]));
	const scores = {};
	for (const [key, value] of Object.entries(raw)) {
		const n = typeof value === "number" ? value : Number(value);
		if (!Number.isFinite(n)) continue;
		const id = byId.get(key.toLowerCase()) ?? byName.get(key.toLowerCase());
		if (!id) continue;
		scores[id] = Math.min(100, Math.max(0, n));
	}
	if (!Object.keys(scores).length) return null;
	return {
		scores,
		note: typeof body.note === "string" ? body.note.slice(0, 400) : ""
	};
}
var defaultLayers = {
	choropleth: true,
	radar: true,
	owmTiles: false,
	quakes: true,
	floods: true,
	fires: true,
	storms: true,
	volcanoes: true,
	other: true,
	radius: true,
	faultsActive: true,
	faultsDormant: true
};
function mergeLayers(layers) {
	return {
		...defaultLayers,
		...layers
	};
}
var defaultPrefs = {
	radiusKm: 200,
	minQuakeAlert: 4,
	alertsOn: true,
	owmKey: "",
	nasaKey: "",
	minimaxKey: "",
	hintDismissed: false,
	layers: defaultLayers
};
var useAtlas = create()(persist((set) => ({
	prefs: defaultPrefs,
	setPrefs: (prefs) => set({ prefs }),
	patchPrefs: (partial) => set((state) => ({ prefs: {
		...state.prefs,
		...partial
	} })),
	metric: "flood",
	setMetric: (metric) => set({
		metric,
		aiLayer: null
	}),
	selectedIso: null,
	setSelectedIso: (selectedIso) => set({ selectedIso }),
	selectedEventId: null,
	setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
	location: null,
	setLocation: (location) => set({ location }),
	locStatus: "idle",
	setLocStatus: (locStatus) => set({ locStatus }),
	sheet: null,
	setSheet: (sheet) => set({ sheet }),
	prefsOpen: false,
	setPrefsOpen: (prefsOpen) => set({ prefsOpen }),
	flyRequest: null,
	requestFly: (lon, lat, zoom = 4.4) => set({ flyRequest: {
		lon,
		lat,
		zoom,
		nonce: Date.now()
	} }),
	zoomNonce: 0,
	zoomBy: 0,
	nudgeZoom: (delta) => set((state) => ({
		zoomBy: delta,
		zoomNonce: state.zoomNonce + 1
	})),
	pendingPrompt: null,
	queuePrompt: (pendingPrompt) => set({
		pendingPrompt,
		sheet: "agent"
	}),
	clearPrompt: () => set({ pendingPrompt: null }),
	owmRain: {},
	setOwmRain: (owmRain) => set({ owmRain }),
	aiLayer: null,
	setAiLayer: (aiLayer) => set({ aiLayer })
}), {
	name: "meridian-prefs",
	skipHydration: true,
	partialize: (state) => ({
		prefs: state.prefs,
		metric: state.metric,
		location: state.location
	}),
	merge: (persisted, current) => {
		const saved = persisted ?? {};
		const savedPrefs = saved.prefs;
		return {
			...current,
			...saved,
			prefs: {
				...defaultPrefs,
				...savedPrefs,
				layers: mergeLayers(savedPrefs?.layers)
			}
		};
	}
}));
function cleanPlace(raw) {
	const cleaned = raw.split(/\b(?:of the|using|with live|showing)\b/i)[0].replace(/[?.!]+$/g, "").trim();
	if (!cleaned || /^(the\s+)?(clouds?|rain|rains|radar|doppler|weather|sky)$/i.test(cleaned)) return null;
	return cleaned.slice(0, 120);
}
function readIntent(text) {
	const q = text.replace(/\s+/g, " ").trim();
	const clouds = /\b(clouds?|satellite)\b/i.test(q);
	const rainWord = /\b(doppler|radar|rain)\b/i.test(q);
	const chart = /\b(chart|charts|graph|stats|statistics|plot)\b/i.test(q);
	const web = /\b(web ?search|search the web|look up|webpage|web page|article|wikipedia)\b/i.test(q);
	const mapOf = q.match(/\bmap of\s+(.+)/i);
	const weatherIn = q.match(/\bweather\s+(?:in|for|at|around|over|near)\s+(.+)/i);
	const radarOf = q.match(/\bradar\s+(?:of|over|for|in|around|near)\s+(.+)/i);
	const place = cleanPlace(mapOf?.[1] || weatherIn?.[1] || radarOf?.[1] || "");
	const rain = rainWord || !!place && !clouds;
	const radar = rain || clouds || !!place;
	return {
		visual: radar || chart || web || !!place,
		radar,
		clouds,
		rain,
		place,
		chart,
		web
	};
}
function escapeHtml(value) {
	const amp = "&amp;";
	const lt = "&lt;";
	const gt = "&gt;";
	const quot = "&quot;";
	return value.replace(/[&<>"]/g, (ch) => ch === "&" ? amp : ch === "<" ? lt : ch === ">" ? gt : quot);
}
var NONE = "Sorry no info could be retrieved from web search.";
function openSourcesPage(title, links) {
	const usable = links.filter((link) => link.label && link.url);
	const body = usable.length ? `<ul>${usable.map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a><div>${escapeHtml(link.url)}</div></li>`).join("")}</ul>` : `<p>${NONE}</p>`;
	const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "Sources")}</title><style>html,body{margin:0;background:#101820;color:#e8eef6}body{padding:2rem;font:16px/1.45 sans-serif}a{color:#3ec6ff}li{margin:.8rem 0}div{color:#8ea0b3;font-size:13px;word-break:break-all}</style></head><body><h1>${escapeHtml(title || "Sources")}</h1>${body}</body></html>`;
	const page = window.open("", "_blank");
	if (!page) return;
	page.document.open();
	page.document.write(html);
	page.document.close();
}
function spot(index) {
	const width = typeof window === "undefined" ? 1280 : window.innerWidth;
	return {
		x: Math.max(12, width - 860 - index * 18),
		y: 88 + index % 5 * 22
	};
}
var useDesk = create()(persist((set, get) => ({
	windows: [],
	widget: {
		x: 280,
		y: 150
	},
	z: 1,
	open: (draft) => {
		const existing = get().windows.find((item) => item.kind === draft.kind && item.title === draft.title);
		if (existing) {
			set((state) => ({
				z: state.z + 1,
				windows: state.windows.map((item) => item.id === existing.id ? {
					...item,
					...draft,
					id: item.id,
					minimized: false,
					z: state.z + 1
				} : item)
			}));
			return;
		}
		const at = spot(get().windows.length);
		const z = get().z + 1;
		const next = {
			...draft,
			id: crypto.randomUUID(),
			x: at.x,
			y: at.y,
			z,
			minimized: false,
			pinned: false
		};
		set((state) => ({
			z,
			windows: [...state.windows, next]
		}));
	},
	close: (id) => set((state) => ({ windows: state.windows.filter((item) => item.id !== id) })),
	minimize: (id) => set((state) => ({ windows: state.windows.map((item) => item.id === id ? {
		...item,
		minimized: true
	} : item) })),
	restore: (id) => set((state) => ({
		z: state.z + 1,
		windows: state.windows.map((item) => item.id === id ? {
			...item,
			minimized: false,
			z: state.z + 1
		} : item)
	})),
	togglePin: (id) => set((state) => ({ windows: state.windows.map((item) => item.id === id ? {
		...item,
		pinned: !item.pinned
	} : item) })),
	focus: (id) => set((state) => ({
		z: state.z + 1,
		windows: state.windows.map((item) => item.id === id ? {
			...item,
			z: state.z + 1
		} : item)
	})),
	move: (id, x, y) => set((state) => ({ windows: state.windows.map((item) => item.id === id ? {
		...item,
		x,
		y
	} : item) })),
	moveWidget: (x, y) => set({ widget: {
		x,
		y
	} })
}), {
	name: "gwn-desk",
	skipHydration: true,
	partialize: (state) => ({
		widget: state.widget,
		windows: state.windows.filter((item) => item.pinned)
	})
}));
function CopilotDock({ context, headlines, spaceWeather, countries, metric }) {
	const minimaxKey = useAtlas((s) => s.prefs.minimaxKey);
	const pending = useAtlas((s) => s.pendingPrompt);
	const clearPrompt = useAtlas((s) => s.clearPrompt);
	const setAiLayer = useAtlas((s) => s.setAiLayer);
	const [tab, setTab] = (0, import_react.useState)("ask");
	const [draft, setDraft] = (0, import_react.useState)("");
	const [turns, setTurns] = (0, import_react.useState)([]);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const sentPrompt = (0, import_react.useRef)(null);
	const scroller = (0, import_react.useRef)(null);
	const contextRef = (0, import_react.useRef)(context);
	contextRef.current = context;
	(0, import_react.useEffect)(() => {
		scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
	}, [turns, busy]);
	(0, import_react.useEffect)(() => {
		if (!pending || sentPrompt.current === pending) return;
		sentPrompt.current = pending;
		clearPrompt();
		send(pending, "chat");
	}, [pending]);
	async function send(text, mode) {
		const content = text.trim();
		if (!content || busy) return;
		setError(null);
		setBusy(true);
		setTab("ask");
		const history = mode === "chat" ? [...turns, {
			role: "user",
			content
		}] : [];
		if (mode === "chat") setTurns(history);
		setDraft("");
		try {
			const intent = mode === "chat" ? readIntent(content) : null;
			const here = useAtlas.getState().location;
			const deskJob = intent?.visual ? openDeskView({ data: {
				question: content,
				place: intent.place,
				wantRadar: intent.radar,
				wantClouds: intent.clouds,
				wantRain: intent.rain,
				wantChart: intent.chart,
				wantWeb: intent.web,
				unit: metric,
				centerLat: here?.lat ?? null,
				centerLon: here?.lon ?? null,
				bars: intent.chart ? [...countries].sort((a, b) => b.score - a.score).slice(0, 8).map((country) => ({
					label: country.name,
					value: country.score
				})) : []
			} }).catch(() => null) : Promise.resolve(null);
			const [result, desk] = await Promise.all([askAnalyst({ data: {
				minimaxKey,
				context: contextRef.current,
				mode,
				messages: history.map((turn) => ({
					role: turn.role,
					content: turn.content
				}))
			} }), deskJob]);
			const sources = desk?.windows[0]?.sources;
			if (desk) for (const view of desk.windows) useDesk.getState().open(view);
			const opened = desk?.note ? `\n\n${desk.note}` : "";
			if (!result.ok) {
				setError(result.error);
				if (opened) setTurns((current) => [...current, {
					role: "assistant",
					content: desk?.note || "",
					sources
				}]);
				return;
			}
			if (mode === "refine") {
				const parsed = parseLayerScores(result.text, countries);
				if (!parsed) {
					setError("The analyst did not return a usable layer. The live scores are unchanged.");
					setTurns((current) => [...current, {
						role: "assistant",
						content: result.text,
						model: result.model
					}]);
					return;
				}
				setAiLayer({
					metric,
					values: parsed.scores,
					note: parsed.note
				});
				setTurns((current) => [...current, {
					role: "assistant",
					model: result.model,
					content: parsed.note || `Reweighted ${Object.keys(parsed.scores).length} countries from the live numbers.`
				}]);
				return;
			}
			const lead = mode === "scan" ? "Wire scan" : content;
			setTurns((current) => {
				return [...mode === "chat" ? current : [...current, {
					role: "user",
					content: lead
				}], {
					role: "assistant",
					content: `${result.text}${opened}`,
					model: result.model,
					sources
				}];
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "The analyst could not answer.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "dock h-full",
		"aria-label": "GWN agent",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center justify-between gap-2 border-b border-line px-3 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-2xl leading-none tracking-wide",
				children: "Agent"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: minimaxKey ? "MiniMax M3.1, M3 fallback" : "Built-in analyst, or add MiniMax"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "chip h-9",
					"data-on": tab === "ask" ? "true" : "false",
					onClick: () => setTab("ask"),
					children: "Ask"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "chip h-9",
					"data-on": tab === "wires" ? "true" : "false",
					onClick: () => setTab("wires"),
					children: "Wires"
				})]
			})]
		}), tab === "wires" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dock-scroll flex flex-col gap-2 px-3 py-3",
			children: [
				spaceWeather.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-amber",
						children: "NASA DONKI"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block",
						children: item.title
					})]
				}, item.title)),
				headlines.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "No headlines in this pull."
				}) : null,
				headlines.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: item.url || void 0,
					target: "_blank",
					rel: "noreferrer",
					className: "rounded-xl border border-line px-3 py-2 text-sm hover:border-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-cyan",
						children: item.source
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block",
						children: item.title
					})]
				}, item.title))
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: scroller,
			className: "dock-scroll flex flex-col gap-2 px-3 py-3",
			children: [
				turns.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-sm text-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Ask for a place, a chart, or a page. The result opens on the map, not in this panel." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-col gap-2",
						children: [
							"Show me a map of Montreal, QC with live radar",
							"Show a radar view of the clouds",
							"Chart the live country scores"
						].map((prompt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "chip h-auto justify-start px-3 py-2 text-left",
							onClick: () => void send(prompt, "chat"),
							children: prompt
						}, prompt))
					})]
				}) : null,
				turns.map((turn, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: turn.role === "user" ? "self-end max-w-[90%] rounded-2xl bg-amber px-3 py-2 text-sm text-bg" : "max-w-[95%] rounded-2xl border border-line bg-panel-2 px-3 py-2 text-sm",
					children: [
						turn.model ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-1 text-xs text-muted",
							children: turn.model
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "whitespace-pre-wrap",
							children: turn.content
						}),
						turn.sources && turn.sources.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "chip mt-2",
							onClick: () => openSourcesPage("Sources", turn.sources || []),
							children: "Web sources"
						}) : null
					]
				}, `${turn.role}-${index}`)),
				busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Reading the feeds…"
				}) : null,
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-crimson",
					children: error
				}) : null
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "flex flex-col gap-2 border-t border-line p-3",
			onSubmit: (event) => {
				event.preventDefault();
				send(draft, "chat");
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "chip",
					disabled: busy,
					onClick: () => void send("Scan the latest headlines against the structured events.", "scan"),
					children: "Scan wires"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "chip",
					disabled: busy,
					onClick: () => void send("Weight the active metric from the live numbers and return JSON scores.", "refine"),
					children: "Refine layer"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					className: "field min-h-11 resize-none",
					rows: 2,
					value: draft,
					placeholder: "Ask about a country, a quake, your radius…",
					onChange: (event) => setDraft(event.target.value),
					onKeyDown: (event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							send(draft, "chat");
						}
					}
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "chip",
					"data-on": "true",
					disabled: busy || !draft.trim(),
					children: "Send"
				})]
			})]
		})] })]
	});
}
function rainTiles(radar, frame) {
	if (!radar?.frames.length) return null;
	const path = radar.frames[frame % radar.frames.length]?.path;
	if (!path) return null;
	return `${radar.host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}
function cloudTiles(lon) {
	const day = (/* @__PURE__ */ new Date(Date.now() - 108e5)).toISOString().slice(0, 10);
	return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${lon != null && lon < -100 ? "GOES-West_ABI_GeoColor" : "GOES-East_ABI_GeoColor"}/default/${day}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.jpg`;
}
function circle(lon, lat, km) {
	const ring = [];
	for (let i = 0; i <= 64; i++) {
		const bearing = i / 64 * Math.PI * 2;
		const lat2 = lat + km / 110.574 * Math.cos(bearing);
		const lon2 = lon + km / (111.32 * Math.cos(lat * Math.PI / 180)) * Math.sin(bearing);
		ring.push([lon2, lat2]);
	}
	return ring;
}
function drag(start, onMove) {
	return (event) => {
		if (event.target.closest("button")) return;
		event.preventDefault();
		const ox = event.clientX;
		const oy = event.clientY;
		const move = (ev) => {
			const width = window.innerWidth;
			const height = window.innerHeight;
			onMove(Math.min(width - 48, Math.max(8, start.x + ev.clientX - ox)), Math.min(height - 48, Math.max(64, start.y + ev.clientY - oy)));
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};
}
function MapPane({ item, radarUrl }) {
	const node = (0, import_react.useRef)(null);
	const mapRef = (0, import_react.useRef)(null);
	const rainRef = (0, import_react.useRef)(radarUrl);
	const rainOn = (0, import_react.useRef)(item.showRain);
	const cloudOn = (0, import_react.useRef)(item.showClouds);
	rainRef.current = radarUrl;
	rainOn.current = item.showRain;
	cloudOn.current = item.showClouds;
	(0, import_react.useEffect)(() => {
		if (!node.current) return;
		let dead = false;
		let map = null;
		(async () => {
			const maplibregl = await import("../_libs/maplibre-gl.mjs").then((n) => n.t);
			const workerMod = await import("./maplibre-gl-worker-CQWuOQzD.mjs");
			if (dead || !node.current) return;
			maplibregl.setWorkerUrl(workerMod.default);
			const lat = item.lat ?? 20;
			const lon = item.lon ?? 0;
			map = new maplibregl.Map({
				container: node.current,
				center: [lon, lat],
				zoom: item.radiusKm ? 7 : 1.7,
				attributionControl: false,
				style: {
					version: 8,
					sources: { osm: {
						type: "raster",
						tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
						tileSize: 256,
						attribution: "© OpenStreetMap © CARTO"
					} },
					layers: [{
						id: "osm",
						type: "raster",
						source: "osm"
					}]
				}
			});
			map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
			map.on("load", () => {
				if (!map) return;
				if (item.lat != null && item.lon != null && item.radiusKm) {
					const ring = circle(item.lon, item.lat, item.radiusKm);
					map.addSource("ring", {
						type: "geojson",
						data: {
							type: "Feature",
							properties: {},
							geometry: {
								type: "Polygon",
								coordinates: [ring]
							}
						}
					});
					map.addLayer({
						id: "ring-fill",
						type: "fill",
						source: "ring",
						paint: {
							"fill-color": "#3ec6ff",
							"fill-opacity": .08
						}
					});
					map.addLayer({
						id: "ring-line",
						type: "line",
						source: "ring",
						paint: {
							"line-color": "#3ec6ff",
							"line-width": 1.5
						}
					});
					const lons = ring.map((point) => point[0]);
					const lats = ring.map((point) => point[1]);
					map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
						padding: 18,
						animate: false
					});
				}
				map.resize();
				syncRaster$1(map, "rain", rainRef.current, rainOn.current);
				syncRaster$1(map, "clouds", cloudOn.current ? cloudTiles(item.lon) : null, cloudOn.current);
			});
			mapRef.current = map;
		})();
		return () => {
			dead = true;
			map?.remove();
			mapRef.current = null;
		};
	}, [
		item.id,
		item.lat,
		item.lon,
		item.radiusKm
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map?.isStyleLoaded()) return;
		syncRaster$1(map, "rain", radarUrl, item.showRain);
		syncRaster$1(map, "clouds", item.showClouds ? cloudTiles(item.lon) : null, item.showClouds);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: node,
		className: "absolute inset-0"
	});
}
function syncRaster$1(map, id, tiles, visible) {
	if (!map.getSource(id) && tiles) {
		map.addSource(id, {
			type: "raster",
			tiles: [tiles],
			tileSize: 256
		});
		map.addLayer({
			id,
			type: "raster",
			source: id,
			paint: { "raster-opacity": id === "clouds" ? .72 : .62 }
		});
	}
	const source = map.getSource(id);
	if (source?.setTiles && tiles) source.setTiles([tiles]);
	if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible && tiles ? "visible" : "none");
}
function ChartPane({ item }) {
	const max = Math.max(...item.bars.map((bar) => bar.value), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col gap-2 overflow-auto p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted",
			children: item.summary
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
			viewBox: `0 0 320 ${item.bars.length * 28 + 8}`,
			className: "w-full",
			role: "img",
			"aria-label": item.title,
			children: item.bars.map((bar, index) => {
				const width = Math.max(2, bar.value / max * 210);
				const y = 8 + index * 28;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: "0",
						y: y + 12,
						fill: "#e8eef6",
						fontSize: "11",
						children: bar.label.slice(0, 16)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: "104",
						y,
						width,
						height: "16",
						rx: "4",
						fill: "#f5c518"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: 110 + width,
						y: y + 12,
						fill: "#8ea0b3",
						fontSize: "11",
						children: Math.round(bar.value)
					})
				] }, bar.label);
			})
		})]
	});
}
function WebPane({ item }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "h-full overflow-auto bg-panel-2 px-4 py-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-amber",
				children: "Page"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-1 font-display text-2xl leading-none",
				children: item.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 whitespace-pre-wrap",
				children: item.summary || "Sorry no info could be retrieved from web search."
			}),
			item.pageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: item.pageUrl,
				target: "_blank",
				rel: "noreferrer",
				className: "mt-3 inline-block text-cyan hover:underline",
				children: "Open the full page"
			}) : null
		]
	});
}
function WindowCard({ item, radarUrl }) {
	const focus = useDesk((s) => s.focus);
	const close = useDesk((s) => s.close);
	const minimize = useDesk((s) => s.minimize);
	const togglePin = useDesk((s) => s.togglePin);
	const move = useDesk((s) => s.move);
	const weather = item.weather ? `${weatherText(item.weather.code)}${item.weather.tempC != null ? ` · ${Math.round(item.weather.tempC)}°C` : ""}${item.weather.rain != null ? ` · rain ${item.weather.rain} mm` : ""}` : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "pointer-events-auto absolute flex w-[min(440px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel/95 shadow-2xl backdrop-blur-md",
		style: {
			left: item.x,
			top: item.y,
			zIndex: 10 + item.z,
			height: 360
		},
		onPointerDown: () => focus(item.id),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex cursor-grab items-center gap-2 border-b border-line px-2 py-2 active:cursor-grabbing",
				onPointerDown: drag({
					x: item.x,
					y: item.y
				}, (x, y) => move(item.id, x, y)),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "min-w-0 flex-1 truncate font-display text-lg leading-none tracking-wide",
						children: item.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "icon-btn",
						"aria-label": item.pinned ? "Unpin window" : "Pin window",
						onClick: () => togglePin(item.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, { className: item.pinned ? "size-4 text-amber" : "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "icon-btn",
						"aria-label": "Minimize window",
						onClick: () => minimize(item.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "icon-btn",
						"aria-label": "Close window",
						onClick: () => close(item.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-h-0 flex-1 bg-bg",
				children: [
					item.kind === "chart" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartPane, { item }) : null,
					item.kind === "web" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WebPane, { item }) : null,
					item.kind === "radar" || item.kind === "place" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPane, {
						item,
						radarUrl
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "flex items-center justify-between gap-2 border-t border-line px-2 py-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "truncate text-xs text-muted",
					children: [item.radiusKm ? `${item.radiusKm} km · ` : "", weather || item.summary]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "chip shrink-0",
					onClick: () => openSourcesPage(item.title, item.sources),
					children: "Web sources"
				})]
			})
		]
	});
}
var KIND_ICON = {
	radar: CloudRain,
	place: Map$1,
	chart: ChartColumn,
	web: Globe
};
function Desk({ radar, frame }) {
	const windows = useDesk((s) => s.windows);
	const widget = useDesk((s) => s.widget);
	const moveWidget = useDesk((s) => s.moveWidget);
	const restore = useDesk((s) => s.restore);
	const focus = useDesk((s) => s.focus);
	const close = useDesk((s) => s.close);
	const radarUrl = rainTiles(radar, frame);
	(0, import_react.useEffect)(() => {
		Promise.resolve(useDesk.persist.rehydrate());
	}, []);
	if (windows.length === 0) return null;
	const open = windows.filter((item) => !item.minimized);
	const minimized = windows.filter((item) => item.minimized);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0",
		children: [
			open.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WindowCard, {
				item,
				radarUrl
			}, item.id)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-auto absolute flex items-center gap-1 rounded-full border border-line bg-panel/95 p-1 shadow-lg",
				style: {
					left: widget.x,
					top: widget.y,
					zIndex: 80
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "relative grid size-9 cursor-grab place-items-center rounded-full bg-panel-2 active:cursor-grabbing",
					"aria-label": "Move window tray",
					onPointerDown: drag(widget, moveWidget),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-sm",
						children: "G"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-amber text-[10px] font-semibold text-bg",
						children: windows.length
					})]
				}), windows.map((item, index) => {
					const Icon = KIND_ICON[item.kind];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "relative grid size-9 place-items-center rounded-full border border-line",
						title: item.title,
						"aria-label": item.title,
						onClick: () => item.minimized ? restore(item.id) : focus(item.id),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-panel-2 text-[10px] text-cream",
								children: index + 1
							}),
							item.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute bottom-0.5 size-1.5 rounded-full bg-amber" }) : null
						]
					}, item.id);
				})]
			}),
			minimized.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-auto absolute bottom-3 right-3 z-[70] flex max-w-[calc(100vw-1.5rem)] gap-2 overflow-x-auto lg:right-[22rem]",
				children: minimized.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-center gap-1 rounded-full border border-line bg-panel/95 py-1 pl-3 pr-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "max-w-40 truncate text-sm",
						onClick: () => restore(item.id),
						children: item.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "icon-btn",
						"aria-label": `Close ${item.title}`,
						onClick: () => close(item.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
					})]
				}, item.id))
			}) : null
		]
	});
}
var EMPTY = {
	type: "FeatureCollection",
	features: []
};
var KIND_COLOR = {
	quake: "#e23b4a",
	flood: "#3ec6ff",
	fire: "#ff8a2a",
	storm: "#b9a6ff",
	volcano: "#f5c518",
	drought: "#c4a574",
	landslide: "#d2c0a0",
	other: "#e8eef6"
};
function volcanoStatus(year, eruptingNow) {
	if (eruptingNow) return "erupting";
	if (year == null) return "dormant";
	const now = (/* @__PURE__ */ new Date()).getFullYear();
	if (year >= now - 1) return "erupting";
	if (year >= now - 50) return "restless";
	return "dormant";
}
function HazardMap(props) {
	const wrapRef = (0, import_react.useRef)(null);
	const mapRef = (0, import_react.useRef)(null);
	const tipRef = (0, import_react.useRef)(null);
	const cardRef = (0, import_react.useRef)(null);
	const tagsRef = (0, import_react.useRef)(null);
	const propsRef = (0, import_react.useRef)(props);
	const hoverRef = (0, import_react.useRef)("");
	const pickRef = (0, import_react.useRef)(null);
	const eventPickRef = (0, import_react.useRef)(null);
	const tagKey = (0, import_react.useRef)("");
	propsRef.current = props;
	const [ready, setReady] = (0, import_react.useState)(false);
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
		const top = propsRef.current.countries.filter((c) => c.score >= .22).slice(0, 8);
		const key = top.map((c) => `${c.id}:${Math.round(c.score * 20)}:${c.maxFloodAlert === "red" || c.maxMag >= 7}`).join(",");
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
	(0, import_react.useEffect)(() => {
		if (!wrapRef.current) return;
		let dead = false;
		let map = null;
		let watch = null;
		(async () => {
			const maplibregl = await import("../_libs/maplibre-gl.mjs").then((n) => n.t);
			const workerMod = await import("./maplibre-gl-worker-CQWuOQzD.mjs");
			if (dead || !wrapRef.current) return;
			maplibregl.setWorkerUrl(workerMod.default);
			const narrow = wrapRef.current.clientWidth < 800;
			map = new maplibregl.Map({
				container: wrapRef.current,
				style: {
					version: 8,
					sources: {},
					layers: [{
						id: "bg",
						type: "background",
						paint: { "background-color": "#070b12" }
					}]
				},
				center: [8, 16],
				zoom: narrow ? 1.05 : 1.55,
				attributionControl: false,
				dragRotate: false,
				pitchWithRotate: false,
				maxZoom: 12,
				minZoom: .8
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
			map.on("mousemove", (event) => onMove(map, event.point.x, event.point.y));
			map.on("mouseout", () => clearHover(map));
			map.on("click", (event) => onClick(map, event.point.x, event.point.y));
			map.on("move", () => placeTags());
		})();
		return () => {
			dead = true;
			setReady(false);
			watch?.disconnect();
			map?.remove();
			mapRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map || !props.geo) return;
		const scores = new Map(props.countries.map((country) => [country.id, country.score]));
		const features = props.geo.features.map((feature) => {
			const id = String(feature.id ?? feature.properties.id);
			return {
				...feature,
				id,
				properties: {
					...feature.properties,
					score: scores.get(id) ?? 0
				}
			};
		});
		map.getSource("countries").setData({
			type: "FeatureCollection",
			features
		});
		if (pickRef.current && pickRef.current !== selectedIso) map.setFeatureState({
			source: "countries",
			id: pickRef.current
		}, { picked: false });
		if (selectedIso) map.setFeatureState({
			source: "countries",
			id: selectedIso
		}, { picked: true });
		pickRef.current = selectedIso;
		rebuildTags();
		placeTags();
	}, [
		ready,
		props.geo,
		props.countries,
		selectedIso
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map) return;
		const features = props.events.map((event) => ({
			type: "Feature",
			id: event.id,
			properties: {
				id: event.id,
				kind: event.kind,
				weight: kindWeight(event.kind, event.mag, event.alert),
				color: KIND_COLOR[event.kind],
				countryId: event.countryId,
				title: event.title
			},
			geometry: {
				type: "Point",
				coordinates: [event.lon, event.lat]
			}
		}));
		map.getSource("events").setData({
			type: "FeatureCollection",
			features
		});
		if (eventPickRef.current && eventPickRef.current !== selectedEventId) map.setFeatureState({
			source: "events",
			id: eventPickRef.current
		}, { selected: false });
		if (selectedEventId) map.setFeatureState({
			source: "events",
			id: selectedEventId
		}, { selected: true });
		eventPickRef.current = selectedEventId;
	}, [
		ready,
		props.events,
		selectedEventId
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map) return;
		let dead = false;
		fetch("/geo/faults.geojson").then((res) => {
			if (!res.ok) throw new Error("Fault catalog failed");
			return res.json();
		}).then((data) => {
			if (dead) return;
			(mapRef.current?.getSource("faults"))?.setData(data);
		}).catch((err) => console.warn(err instanceof Error ? err.message : "Fault catalog failed"));
		return () => {
			dead = true;
		};
	}, [ready]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map) return;
		const live = props.events.filter((event) => event.kind === "volcano");
		const features = (props.volcanoes?.features ?? []).map((feature) => {
			const [lon, lat] = feature.geometry.coordinates;
			const eruptingNow = live.some((event) => Math.abs(event.lon - lon) < .45 && Math.abs(event.lat - lat) < .45);
			return {
				type: "Feature",
				properties: {
					...feature.properties,
					status: volcanoStatus(feature.properties.year, eruptingNow)
				},
				geometry: feature.geometry
			};
		});
		map.getSource("volcanoes").setData({
			type: "FeatureCollection",
			features
		});
	}, [
		ready,
		props.volcanoes,
		props.events
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map?.getLayer("events-circle")) return;
		const layers = mergeLayers(props.layers);
		const filter = [
			"in",
			["get", "kind"],
			["literal", [
				layers.quakes && "quake",
				layers.floods && "flood",
				layers.fires && "fire",
				layers.storms && "storm",
				layers.volcanoes && "volcano",
				layers.other && "drought",
				layers.other && "landslide",
				layers.other && "other"
			].filter((kind) => Boolean(kind))]
		];
		map.setFilter("events-circle", filter);
		map.setFilter("events-glow", filter);
		map.setLayoutProperty("countries-fill", "visibility", layers.choropleth ? "visible" : "none");
		if (map.getLayer("faults-active")) map.setLayoutProperty("faults-active", "visibility", layers.faultsActive ? "visible" : "none");
		if (map.getLayer("faults-dormant")) map.setLayoutProperty("faults-dormant", "visibility", layers.faultsDormant ? "visible" : "none");
		const volcanoVis = layers.volcanoes ? "visible" : "none";
		if (map.getLayer("volcano-dot")) map.setLayoutProperty("volcano-dot", "visibility", volcanoVis);
		if (map.getLayer("volcano-glow")) map.setLayoutProperty("volcano-glow", "visibility", volcanoVis);
	}, [ready, props.layers]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map) return;
		const radius = map.getSource("radius");
		const user = map.getSource("user");
		if (!props.location || !props.layers.radius) {
			radius.setData(EMPTY);
			user.setData(EMPTY);
			return;
		}
		radius.setData({
			type: "FeatureCollection",
			features: [{
				type: "Feature",
				properties: {},
				geometry: {
					type: "Polygon",
					coordinates: [circleRing(props.location.lon, props.location.lat, props.radiusKm)]
				}
			}]
		});
		user.setData({
			type: "FeatureCollection",
			features: [{
				type: "Feature",
				properties: {},
				geometry: {
					type: "Point",
					coordinates: [props.location.lon, props.location.lat]
				}
			}]
		});
	}, [
		ready,
		props.location,
		props.radiusKm,
		props.layers.radius
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map?.getLayer("countries-fill")) return;
		syncRaster(map, "radar", "Radar © RainViewer", props.layers.radar, radarUrl(props.radar, props.frame), .55);
	}, [
		ready,
		props.radar,
		props.frame,
		props.layers.radar
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!ready || !map?.getLayer("countries-fill")) return;
		const tiles = props.layers.owmTiles && props.owmKey ? [`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(props.owmKey)}`] : null;
		syncRaster(map, "owm", "Precip © OpenWeather", Boolean(tiles), tiles, .62);
	}, [
		ready,
		props.layers.owmTiles,
		props.owmKey
	]);
	(0, import_react.useEffect)(() => {
		if (!ready || !zoomNonce || !mapRef.current) return;
		const delta = useAtlas.getState().zoomBy;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		mapRef.current.zoomTo(mapRef.current.getZoom() + delta, { duration: reduce ? 0 : 220 });
	}, [ready, zoomNonce]);
	(0, import_react.useEffect)(() => {
		if (!ready || !fly || !mapRef.current) return;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		mapRef.current.flyTo({
			center: [fly.lon, fly.lat],
			zoom: fly.zoom,
			duration: reduce ? 0 : 1100,
			essential: true
		});
	}, [ready, fly]);
	function onMove(map, x, y) {
		const tip = tipRef.current;
		if (!tip || !map.getLayer("events-circle")) return;
		const hitEvent = map.queryRenderedFeatures([x, y], { layers: ["events-circle"] })[0];
		const hitVolcano = map.getLayer("volcano-dot") ? map.queryRenderedFeatures([x, y], { layers: ["volcano-dot"] })[0] : void 0;
		const hitFault = map.getLayer("faults-active") && map.getLayer("faults-dormant") ? map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: ["faults-active", "faults-dormant"] })[0] : void 0;
		const hitCountry = map.queryRenderedFeatures([x, y], { layers: ["countries-fill"] })[0];
		const eventId = hitEvent ? String(hitEvent.properties?.id ?? "") : "";
		const volcanoId = hitVolcano ? String(hitVolcano.properties?.id ?? "") : "";
		const faultName = hitFault ? String(hitFault.properties?.n || hitFault.properties?.s || "Fault") : "";
		const iso = hitCountry ? String(hitCountry.id ?? hitCountry.properties?.id ?? "") : "";
		tip.style.transform = `translate(${x + 14}px, ${y + 16}px)`;
		const key = `${eventId}|${volcanoId}|${faultName}|${iso}`;
		if (key !== hoverRef.current) {
			const prev = hoverRef.current.split("|")[3];
			if (prev) map.setFeatureState({
				source: "countries",
				id: prev
			}, { hover: false });
			hoverRef.current = key;
			if (iso && !eventId && !volcanoId && !faultName) map.setFeatureState({
				source: "countries",
				id: iso
			}, { hover: true });
			fillTip(tip, eventId, iso, hitVolcano?.properties, hitFault?.properties);
		}
		tip.hidden = !eventId && !volcanoId && !faultName && !iso;
		map.getCanvas().style.cursor = eventId || volcanoId || faultName || iso ? "pointer" : "";
	}
	function clearHover(map) {
		if (tipRef.current) tipRef.current.hidden = true;
		const prev = hoverRef.current.split("|")[3];
		if (prev && map.getLayer("countries-fill")) map.setFeatureState({
			source: "countries",
			id: prev
		}, { hover: false });
		hoverRef.current = "";
	}
	function hideCard() {
		if (cardRef.current) cardRef.current.hidden = true;
	}
	function showCard(x, y, heading, lines) {
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
	function onClick(map, x, y) {
		if (!map.getLayer("events-circle")) return;
		const hitEvent = map.queryRenderedFeatures([x, y], { layers: ["events-circle"] })[0];
		const hitVolcano = map.getLayer("volcano-dot") ? map.queryRenderedFeatures([x, y], { layers: ["volcano-dot"] })[0] : void 0;
		const hitCountry = map.queryRenderedFeatures([x, y], { layers: ["countries-fill"] })[0];
		const state = useAtlas.getState();
		const narrow = window.matchMedia("(max-width: 767px)").matches;
		if (hitEvent) {
			const event = propsRef.current.events.find((item) => item.id === String(hitEvent.properties?.id ?? ""));
			state.setSelectedEventId(String(hitEvent.properties?.id ?? ""));
			const iso = String(hitEvent.properties?.countryId ?? "");
			if (iso) state.setSelectedIso(iso);
			if (event) showCard(x, y, event.place || event.title, [
				{
					label: "Type",
					value: KIND_LABEL[event.kind]
				},
				{
					label: "Magnitude",
					value: event.mag != null ? String(event.mag) : ""
				},
				{
					label: "Alert",
					value: event.alert
				},
				{
					label: "Source",
					value: event.source
				},
				{
					label: "When",
					value: ago(event.time)
				},
				{
					label: "Where",
					value: event.countryName || ""
				}
			]);
			if (narrow) state.setSheet("places");
			return;
		}
		if (hitVolcano) {
			const volcano = hitVolcano.properties ?? {};
			const year = volcano.year == null || volcano.year === "" ? null : Number(volcano.year);
			const when = year == null || Number.isNaN(year) ? "undated" : year < 0 ? `${Math.abs(year)} BCE` : String(year);
			showCard(x, y, String(volcano.name || "Volcano"), [
				{
					label: "Type",
					value: String(volcano.kind || volcano.status || "Volcano")
				},
				{
					label: "Status",
					value: String(volcano.status || "")
				},
				{
					label: "Location",
					value: String(volcano.country || "")
				},
				{
					label: "Last eruption",
					value: when
				},
				{
					label: "Elevation",
					value: volcano.elev ? `${volcano.elev} m` : ""
				}
			]);
			if (hitVolcano.geometry.type === "Point") {
				const [lon, lat] = hitVolcano.geometry.coordinates;
				state.requestFly(lon, lat, 5.2);
			}
			return;
		}
		const hitFault = map.getLayer("faults-active") && map.getLayer("faults-dormant") ? map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: ["faults-active", "faults-dormant"] })[0] : void 0;
		if (hitFault) {
			const fault = hitFault.properties ?? {};
			const active = fault.c === "a";
			showCard(x, y, String(fault.n || "Unnamed fault"), [{
				label: "Type",
				value: active ? "Active fault" : "Dormant fault"
			}, {
				label: "Style",
				value: String(fault.s || "")
			}]);
			return;
		}
		hideCard();
		if (hitCountry) {
			state.setSelectedIso(String(hitCountry.id ?? hitCountry.properties?.id ?? ""));
			state.setSelectedEventId(null);
			if (narrow) state.setSheet("places");
		}
	}
	function fillTip(tip, eventId, iso, volcano, fault) {
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
			meta.textContent = `${status} · last eruption ${year == null ? "no dated eruption" : year < 0 ? `${Math.abs(year)} BCE` : String(year)}${volcano.country ? ` · ${volcano.country}` : ""}`;
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		className: "map-stage absolute inset-0",
		style: {
			position: "absolute",
			inset: 0,
			width: "100%",
			height: "100%"
		},
		role: "application",
		"aria-label": "World hazard map",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: tagsRef,
				className: "pointer-events-none absolute inset-0 z-10 [&>button]:pointer-events-auto"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: cardRef,
				hidden: true,
				className: "absolute left-0 top-0 z-30 w-56 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream shadow-lg"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: tipRef,
				hidden: true,
				className: "pointer-events-none absolute left-0 top-0 z-20 max-w-64 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream shadow-lg"
			})
		]
	});
}
function addBase(map) {
	map.addSource("sat", {
		type: "raster",
		tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
		tileSize: 256,
		maxzoom: 12,
		attribution: "Imagery © Esri"
	});
	map.addLayer({
		id: "sat",
		type: "raster",
		source: "sat",
		paint: {
			"raster-opacity": .78,
			"raster-saturation": -.2,
			"raster-contrast": .12,
			"raster-brightness-max": .72
		}
	});
	map.addSource("countries", {
		type: "geojson",
		data: EMPTY
	});
	map.addLayer({
		id: "countries-fill",
		type: "fill",
		source: "countries",
		paint: {
			"fill-color": [
				"interpolate",
				["linear"],
				[
					"coalesce",
					["get", "score"],
					0
				],
				0,
				"#163044",
				.2,
				"#0e6e8c",
				.4,
				"#1c8cff",
				.58,
				"#7a3cff",
				.76,
				"#e23b4a",
				1,
				"#f5c518"
			],
			"fill-opacity": [
				"interpolate",
				["linear"],
				[
					"coalesce",
					["get", "score"],
					0
				],
				0,
				.18,
				.18,
				.45,
				.5,
				.62,
				1,
				.82
			]
		}
	});
	map.addLayer({
		id: "countries-line",
		type: "line",
		source: "countries",
		paint: {
			"line-color": [
				"case",
				[
					"boolean",
					["feature-state", "picked"],
					false
				],
				"#f5c518",
				[
					"boolean",
					["feature-state", "hover"],
					false
				],
				"#e8eef6",
				"#9fb4c8"
			],
			"line-width": [
				"case",
				[
					"boolean",
					["feature-state", "picked"],
					false
				],
				1.8,
				[
					"boolean",
					["feature-state", "hover"],
					false
				],
				1.2,
				.55
			],
			"line-opacity": .85
		}
	});
	map.addSource("faults", {
		type: "geojson",
		data: EMPTY,
		attribution: "Faults © GEM Global Active Faults (CC-BY-SA)"
	});
	map.addLayer({
		id: "faults-dormant",
		type: "line",
		source: "faults",
		filter: [
			"==",
			["get", "c"],
			"d"
		],
		paint: {
			"line-color": "#9aa8b8",
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				1,
				.6,
				6,
				1.8
			],
			"line-opacity": .7,
			"line-dasharray": [1.1, .9]
		}
	});
	map.addLayer({
		id: "faults-active",
		type: "line",
		source: "faults",
		filter: [
			"==",
			["get", "c"],
			"a"
		],
		paint: {
			"line-color": "#e7a23a",
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				1,
				.7,
				6,
				2.2
			],
			"line-opacity": .82
		}
	});
	map.addSource("volcanoes", {
		type: "geojson",
		data: EMPTY,
		attribution: "Volcanoes © Smithsonian GVP"
	});
	map.addLayer({
		id: "volcano-glow",
		type: "circle",
		source: "volcanoes",
		filter: [
			"==",
			["get", "status"],
			"erupting"
		],
		paint: {
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				1,
				8,
				6,
				16
			],
			"circle-color": "#f5c518",
			"circle-blur": .8,
			"circle-opacity": .45
		}
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
				[
					"match",
					["get", "status"],
					"erupting",
					4.5,
					"restless",
					3,
					1.6
				],
				6,
				[
					"match",
					["get", "status"],
					"erupting",
					8,
					"restless",
					6,
					3.5
				]
			],
			"circle-color": [
				"match",
				["get", "status"],
				"erupting",
				"#f5c518",
				"restless",
				"#ff8a2a",
				"#8ea0b3"
			],
			"circle-stroke-color": "#070b12",
			"circle-stroke-width": [
				"match",
				["get", "status"],
				"dormant",
				0,
				1
			],
			"circle-opacity": [
				"match",
				["get", "status"],
				"dormant",
				.72,
				.95
			]
		}
	});
	map.addSource("radius", {
		type: "geojson",
		data: EMPTY
	});
	map.addLayer({
		id: "radius-fill",
		type: "fill",
		source: "radius",
		paint: {
			"fill-color": "#f5c518",
			"fill-opacity": .08
		}
	});
	map.addLayer({
		id: "radius-line",
		type: "line",
		source: "radius",
		paint: {
			"line-color": "#f5c518",
			"line-width": 1.4,
			"line-dasharray": [1.4, 1.2]
		}
	});
	map.addSource("events", {
		type: "geojson",
		data: EMPTY
	});
	map.addLayer({
		id: "events-glow",
		type: "circle",
		source: "events",
		paint: {
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				1,
				[
					"*",
					["get", "weight"],
					1.1
				],
				6,
				[
					"*",
					["get", "weight"],
					2.4
				]
			],
			"circle-color": ["get", "color"],
			"circle-blur": .75,
			"circle-opacity": .45
		}
	});
	map.addLayer({
		id: "events-circle",
		type: "circle",
		source: "events",
		paint: {
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				1,
				[
					"*",
					["get", "weight"],
					.55
				],
				6,
				[
					"*",
					["get", "weight"],
					1.35
				]
			],
			"circle-color": ["get", "color"],
			"circle-stroke-color": [
				"case",
				[
					"boolean",
					["feature-state", "selected"],
					false
				],
				"#f5c518",
				"#070b12"
			],
			"circle-stroke-width": [
				"case",
				[
					"boolean",
					["feature-state", "selected"],
					false
				],
				2.5,
				1
			],
			"circle-opacity": .95
		}
	});
	map.addSource("user", {
		type: "geojson",
		data: EMPTY
	});
	map.addLayer({
		id: "user-dot",
		type: "circle",
		source: "user",
		paint: {
			"circle-radius": 6,
			"circle-color": "#f5c518",
			"circle-stroke-width": 2,
			"circle-stroke-color": "#070b12"
		}
	});
}
function radarUrl(radar, frame) {
	if (!radar?.frames.length) return null;
	const path = radar.frames[frame % radar.frames.length]?.path;
	if (!path) return null;
	return [`${radar.host}${path}/256/{z}/{x}/{y}/2/1_1.png`];
}
function syncRaster(map, id, attribution, show, tiles, opacity) {
	if (show && tiles) {
		if (!map.getSource(id)) {
			map.addSource(id, {
				type: "raster",
				tiles,
				tileSize: 256,
				attribution
			});
			map.addLayer({
				id,
				type: "raster",
				source: id,
				paint: { "raster-opacity": opacity }
			}, "countries-fill");
		} else {
			map.getSource(id).setTiles(tiles);
			map.setLayoutProperty(id, "visibility", "visible");
		}
	} else if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
}
function PlacesDock({ countries, selected, sources, loading, error, onRetry, nearby, onPick, onAsk }) {
	const prefs = useAtlas((s) => s.prefs);
	const location = useAtlas((s) => s.location);
	const selectedEventId = useAtlas((s) => s.selectedEventId);
	const setSelectedIso = useAtlas((s) => s.setSelectedIso);
	const setSelectedEventId = useAtlas((s) => s.setSelectedEventId);
	const requestFly = useAtlas((s) => s.requestFly);
	const forecast = useQuery({
		queryKey: [
			"point",
			selected?.id,
			stampKey(prefs.owmKey)
		],
		enabled: Boolean(selected),
		staleTime: 6e5,
		queryFn: () => pointForecast({ data: {
			lat: selected.lat,
			lon: selected.lon,
			owmKey: prefs.owmKey
		} })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "dock h-full",
		"aria-label": "Countries",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center gap-2 border-b border-line px-3 py-3",
			children: [selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "icon-btn h-10 w-10",
				onClick: () => setSelectedIso(null),
				"aria-label": "Back to countries",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" })
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-2xl leading-none tracking-wide",
					children: selected ? selected.name : "Hotspots"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted",
					children: selected ? selected.continent : loading ? "Pulling live feeds…" : `${countries.length} countries with signal`
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dock-scroll px-3 py-3",
			children: [
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-crimson/50 bg-panel-2 p-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The live feeds did not load." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-muted",
							children: error
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "chip mt-3",
							onClick: onRetry,
							children: "Retry"
						})
					]
				}) : null,
				!selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "flex flex-col gap-2",
					children: [countries.map((country) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onPick(country),
						className: "w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-left hover:border-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-display text-xl leading-none tracking-wide",
									children: country.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular-nums text-sm text-amber",
									children: Math.round(country.score * 100)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 h-1.5 overflow-hidden rounded-full bg-bg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full rounded-full bg-amber",
									style: { width: `${Math.max(4, Math.round(country.score * 100))}%` }
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted",
								children: [
									country.precipMm.toFixed(0),
									" mm rain",
									country.counts.flood ? ` · ${country.counts.flood} flood` : "",
									country.counts.quake ? ` · ${country.counts.quake} quake` : "",
									country.maxMag ? ` · M${country.maxMag}` : "",
									country.counts.fire ? ` · ${country.counts.fire} fire` : "",
									country.counts.storm ? ` · ${country.counts.storm} storm` : ""
								]
							})
						]
					}) }, country.id)), !loading && countries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-muted",
						children: "No elevated countries in this metric yet."
					}) : null]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountryDetail, {
					country: selected,
					location,
					radiusKm: prefs.radiusKm,
					nearby,
					forecast: forecast.data,
					forecastError: forecast.isError ? "Forecast unavailable" : null,
					selectedEventId,
					onEvent: (event) => {
						setSelectedEventId(event.id);
						requestFly(event.lon, event.lat, 5);
					},
					onCenter: () => requestFly(selected.lon, selected.lat, 4.2),
					onAsk: () => onAsk(`What is happening in ${selected.name} right now? Use only the live feeds.`)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 flex flex-wrap gap-1.5",
					children: sources.map((source) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "rounded-full border border-line px-2 py-1 text-xs text-muted",
						title: source.error || `${source.ms} ms`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: source.ok ? "text-cyan" : "text-crimson",
								children: source.ok ? "●" : "○"
							}),
							" ",
							source.label,
							" ",
							source.ok ? source.count : "down"
						]
					}, source.id))
				})
			]
		})]
	});
}
function CountryDetail({ country, location, radiusKm, nearby, forecast, forecastError, selectedEventId, onEvent, onCenter, onAsk }) {
	const distance = location ? haversineKm(location.lat, location.lon, country.lat, country.lon) : null;
	const inside = nearby.filter((item) => item.event.countryId === country.id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-muted",
				children: [
					"Pop ",
					compactPop(country.pop),
					" · pressure ",
					Math.round(country.score * 100),
					" · ",
					country.eventTotal,
					" events in the feed"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-1.5 overflow-hidden rounded-full bg-bg",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full rounded-full bg-amber",
					style: { width: `${Math.max(4, Math.round(country.score * 100))}%` }
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Rain window",
						value: `${country.precipMm.toFixed(1)} mm`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "OpenWeather 1h",
						value: country.owmRain == null ? "—" : `${country.owmRain.toFixed(1)} mm`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Strongest quake",
						value: country.maxMag ? `M${country.maxMag}` : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Flood alert",
						value: country.maxFloodAlert === "info" ? "—" : country.maxFloodAlert
					})
				]
			}),
			distance != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: distance <= radiusKm ? "text-amber" : "text-muted",
				children: [
					Math.round(distance),
					" km from you",
					distance <= radiusKm ? " · inside your alert radius" : ""
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-line bg-panel-2 p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-widest text-muted",
						children: "At the label point"
					}),
					forecast ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1",
						children: [
							weatherText(forecast.code),
							forecast.tempC != null ? ` · ${Math.round(forecast.tempC)}°C` : "",
							forecast.windKmh != null ? ` · wind ${Math.round(forecast.windKmh)} km/h` : "",
							forecast.owm?.description ? ` · OpenWeather ${forecast.owm.description}` : "",
							forecast.place ? ` · ${forecast.place}` : ""
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted",
						children: forecastError || "Reading Open-Meteo…"
					}),
					forecast?.owmError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-crimson",
						children: forecast.owmError
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "chip",
					onClick: onCenter,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-4" }), " Center"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "chip",
					onClick: onAsk,
					children: "Ask the agent"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-2",
				children: country.events.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onEvent(event),
					"data-on": selectedEventId === event.id ? "true" : "false",
					className: "w-full rounded-xl border border-line px-3 py-2 text-left data-[on=true]:border-amber",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs uppercase tracking-wider text-amber",
							children: [
								KIND_LABEL[event.kind],
								" · ",
								event.source,
								event.mag != null ? ` · M${event.mag}` : "",
								" · ",
								event.alert
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5",
							children: event.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted",
							children: [ago(event.time), event.detail ? ` · ${event.detail}` : ""]
						})
					]
				}) }, event.id))
			}),
			country.eventTotal > country.events.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted",
				children: [country.eventTotal - country.events.length, " older events hidden."]
			}) : null,
			inside.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted",
				children: [inside.length, " of these sit inside your radius."]
			}) : null
		]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line bg-bg px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "tabular-nums font-medium",
			children: value
		})]
	});
}
function SettingsForm({ onClose }) {
	const prefs = useAtlas((s) => s.prefs);
	const setPrefs = useAtlas((s) => s.setPrefs);
	const patchPrefs = useAtlas((s) => s.patchPrefs);
	const [keys, setKeys] = (0, import_react.useState)({
		owmKey: prefs.owmKey,
		nasaKey: prefs.nasaKey,
		minimaxKey: prefs.minimaxKey
	});
	(0, import_react.useEffect)(() => {
		setKeys({
			owmKey: prefs.owmKey,
			nasaKey: prefs.nasaKey,
			minimaxKey: prefs.minimaxKey
		});
	}, [
		prefs.owmKey,
		prefs.nasaKey,
		prefs.minimaxKey
	]);
	function save(next) {
		setPrefs({
			...useAtlas.getState().prefs,
			...next
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex max-h-[80dvh] flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center justify-between border-b border-line px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-2xl leading-none tracking-wide",
				children: "Preferences"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: "Keys stay in this browser. They are only sent to that provider."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "icon-btn",
				onClick: onClose,
				"aria-label": "Close preferences",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dock-scroll flex flex-col gap-4 px-4 py-4 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center justify-between",
							children: ["Alert radius", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "tabular-nums text-amber",
								children: [prefs.radiusKm, " km"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							min: 25,
							max: 1e3,
							step: 25,
							value: prefs.radiusKm,
							className: "accent-amber",
							onChange: (event) => patchPrefs({ radiusKm: Number(event.target.value) })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: "Warn when a flood, storm, fire, volcano, or quake at or above your magnitude sits inside this distance."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center justify-between",
						children: ["Quake alert magnitude", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "tabular-nums text-amber",
							children: ["M", prefs.minQuakeAlert.toFixed(1)]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: 2.5,
						max: 7,
						step: .5,
						value: prefs.minQuakeAlert,
						className: "accent-amber",
						onChange: (event) => patchPrefs({ minQuakeAlert: Number(event.target.value) })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Radius warnings" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: prefs.alertsOn,
						onChange: (event) => patchPrefs({ alertsOn: event.target.checked })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyField, {
					label: "OpenWeatherMap key",
					hint: "Blends real 1-hour rain into the flood colors (up to 24 wet countries) and unlocks optional precip tiles.",
					value: keys.owmKey,
					onChange: (owmKey) => setKeys((current) => ({
						...current,
						owmKey
					})),
					onSave: () => save({ owmKey: keys.owmKey.trim() })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyField, {
					label: "NASA API key",
					hint: "Optional. Earth events already come from EONET. A key adds DONKI space-weather notices.",
					value: keys.nasaKey,
					onChange: (nasaKey) => setKeys((current) => ({
						...current,
						nasaKey
					})),
					onSave: () => save({ nasaKey: keys.nasaKey.trim() })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyField, {
					label: "MiniMax key",
					hint: "Headline scan and the copilot use MiniMax-M3.1-Flash-Preview, then MiniMax-M3. Without a key, GWN uses the built-in analyst.",
					value: keys.minimaxKey,
					onChange: (minimaxKey) => setKeys((current) => ({
						...current,
						minimaxKey
					})),
					onSave: () => save({ minimaxKey: keys.minimaxKey.trim() })
				})
			]
		})]
	});
}
function KeyField({ label, hint, value, onChange, onSave }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "flex flex-col gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-muted",
				children: hint
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "password",
					autoComplete: "off",
					className: "field",
					value,
					placeholder: "Paste key",
					onChange: (event) => onChange(event.target.value)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "chip",
					"data-on": "true",
					onClick: onSave,
					children: "Save"
				})]
			})
		]
	});
}
function AtlasApp() {
	const [client] = (0, import_react.useState)(() => new QueryClient({ defaultOptions: { queries: {
		retry: 1,
		refetchOnWindowFocus: false
	} } }));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AtlasInner, {})
	});
}
function AtlasInner() {
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	const queryClient = useQueryClient();
	const prefs = useAtlas((s) => s.prefs);
	const metric = useAtlas((s) => s.metric);
	const setMetric = useAtlas((s) => s.setMetric);
	const selectedIso = useAtlas((s) => s.selectedIso);
	const location = useAtlas((s) => s.location);
	const setLocation = useAtlas((s) => s.setLocation);
	const locStatus = useAtlas((s) => s.locStatus);
	const setLocStatus = useAtlas((s) => s.setLocStatus);
	const sheet = useAtlas((s) => s.sheet);
	const setSheet = useAtlas((s) => s.setSheet);
	const prefsOpen = useAtlas((s) => s.prefsOpen);
	const setPrefsOpen = useAtlas((s) => s.setPrefsOpen);
	const requestFly = useAtlas((s) => s.requestFly);
	const nudgeZoom = useAtlas((s) => s.nudgeZoom);
	const patchPrefs = useAtlas((s) => s.patchPrefs);
	const owmRain = useAtlas((s) => s.owmRain);
	const setOwmRain = useAtlas((s) => s.setOwmRain);
	const aiLayer = useAtlas((s) => s.aiLayer);
	const queuePrompt = useAtlas((s) => s.queuePrompt);
	const [frame, setFrame] = (0, import_react.useState)(0);
	const [radarPlay, setRadarPlay] = (0, import_react.useState)(true);
	const [layersOpen, setLayersOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		Promise.resolve(useAtlas.persist.rehydrate()).then(() => setHydrated(true));
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setRadarPlay(false);
	}, []);
	const geoQuery = useQuery({
		queryKey: ["countries-geo"],
		queryFn: async () => {
			const res = await fetch("/geo/countries.geojson");
			if (!res.ok) throw new Error("Country boundaries failed to load");
			return await res.json();
		},
		staleTime: Infinity
	});
	const volcanoQuery = useQuery({
		queryKey: ["volcano-catalog"],
		queryFn: async () => {
			const res = await fetch("/geo/volcanoes.geojson");
			if (!res.ok) throw new Error("Volcano catalog failed to load");
			return await res.json();
		},
		staleTime: Infinity
	});
	const atlasQuery = useQuery({
		queryKey: ["atlas", stampKey(prefs.nasaKey)],
		enabled: hydrated,
		refetchInterval: 12e4,
		queryFn: () => loadAtlas({ data: { nasaKey: prefs.nasaKey } })
	});
	const prep = (0, import_react.useMemo)(() => geoQuery.data ? prepareCountries(geoQuery.data) : [], [geoQuery.data]);
	const blendPoints = (0, import_react.useMemo)(() => {
		if (!prep.length || !atlasQuery.data) return [];
		const rain = new Map(atlasQuery.data.precip.map((row) => [row.id, row.mm]));
		return prep.map((country) => ({
			id: country.id,
			lat: country.lat,
			lon: country.lon,
			mm: rain.get(country.id) ?? 0
		})).sort((a, b) => b.mm - a.mm).filter((country) => country.mm >= 8).slice(0, 24).map(({ id, lat, lon }) => ({
			id,
			lat,
			lon
		}));
	}, [prep, atlasQuery.data]);
	const blendQuery = useQuery({
		queryKey: [
			"owm-blend",
			stampKey(prefs.owmKey),
			blendPoints.map((point) => point.id).join(",")
		],
		enabled: hydrated && Boolean(prefs.owmKey) && blendPoints.length > 0,
		staleTime: 6e5,
		refetchInterval: 6e5,
		queryFn: () => blendOpenWeather({ data: {
			owmKey: prefs.owmKey,
			points: blendPoints
		} })
	});
	(0, import_react.useEffect)(() => {
		if (!blendQuery.data) return;
		const next = {};
		for (const row of blendQuery.data.rows) next[row.id] = row.rain1h;
		setOwmRain(next);
	}, [blendQuery.data, setOwmRain]);
	const model = (0, import_react.useMemo)(() => {
		if (!prep.length) return null;
		return buildAtlasModel(prep, atlasQuery.data?.events ?? [], atlasQuery.data?.precip ?? [], metric, owmRain, aiLayer);
	}, [
		prep,
		atlasQuery.data,
		metric,
		owmRain,
		aiLayer
	]);
	const ranked = (0, import_react.useMemo)(() => model ? topCountries(model.countries, 16) : [], [model]);
	const selected = model?.countries.find((country) => country.id === selectedIso) ?? null;
	const layers = mergeLayers(prefs.layers);
	const nearby = (0, import_react.useMemo)(() => {
		if (!location || !model) return [];
		const rows = model.events.map((event) => ({
			event,
			km: haversineKm(location.lat, location.lon, event.lat, event.lon)
		})).filter(({ event, km }) => {
			if (km > prefs.radiusKm) return false;
			if (event.kind === "quake") return (event.mag ?? 0) >= prefs.minQuakeAlert;
			return event.kind === "flood" || event.kind === "fire" || event.kind === "storm" || event.kind === "volcano" || event.kind === "landslide";
		});
		const year = (/* @__PURE__ */ new Date()).getFullYear();
		for (const feature of volcanoQuery.data?.features ?? []) {
			const last = feature.properties.year;
			if (last == null || last < year - 1) continue;
			const [lon, lat] = feature.geometry.coordinates;
			const km = haversineKm(location.lat, location.lon, lat, lon);
			if (km > prefs.radiusKm) continue;
			if (model.events.some((event) => event.kind === "volcano" && Math.abs(event.lon - lon) < .5 && Math.abs(event.lat - lat) < .5)) continue;
			rows.push({
				km,
				event: {
					id: `gvp:${feature.properties.id}`,
					source: "Smithsonian",
					kind: "volcano",
					title: `${feature.properties.name} erupting`,
					mag: null,
					alert: "orange",
					lat,
					lon,
					time: (/* @__PURE__ */ new Date()).toISOString(),
					url: `https://volcano.si.edu/volcano.cfm?vn=${feature.properties.id}`,
					place: feature.properties.country,
					isoHint: "",
					detail: last < 0 ? `Last eruption ${Math.abs(last)} BCE` : `Last eruption ${last}`,
					countryId: "",
					countryName: feature.properties.country
				}
			});
		}
		return rows.sort((a, b) => a.km - b.km).slice(0, 8);
	}, [
		location,
		model,
		prefs.radiusKm,
		prefs.minQuakeAlert,
		volcanoQuery.data
	]);
	const here = useQuery({
		queryKey: [
			"here",
			location?.lat.toFixed(2),
			location?.lon.toFixed(2),
			stampKey(prefs.owmKey)
		],
		enabled: Boolean(location),
		staleTime: 6e5,
		queryFn: () => pointForecast({ data: {
			lat: location.lat,
			lon: location.lon,
			owmKey: prefs.owmKey
		} })
	});
	const context = (0, import_react.useMemo)(() => {
		if (!atlasQuery.data || !model) return "Feeds have not loaded.";
		return buildContext({
			payload: atlasQuery.data,
			metric,
			countries: model.countries,
			selected,
			location,
			radiusKm: prefs.radiusKm,
			nearby: nearby.map((item) => ({
				title: item.event.title,
				kind: item.event.kind,
				km: item.km,
				mag: item.event.mag,
				source: item.event.source
			}))
		}) + " Volcano layer: Smithsonian Holocene catalog, 1214 volcanoes. Gold means last eruption this year or last year, or a live eruption report nearby. Orange means an eruption in the last 50 years. Gray is dormant. Fault layer: GEM Global Active Faults. Amber traces are Holocene, historic, or undated active faults, including plate boundaries. Gray dashed traces last moved before the Holocene.";
	}, [
		atlasQuery.data,
		model,
		metric,
		selected,
		location,
		prefs.radiusKm,
		nearby
	]);
	const frames = atlasQuery.data?.radar?.frames.length ?? 0;
	(0, import_react.useEffect)(() => {
		if (!radarPlay || frames < 2) return;
		const id = window.setInterval(() => setFrame((current) => (current + 1) % frames), 1100);
		return () => window.clearInterval(id);
	}, [radarPlay, frames]);
	const metricMeta = METRICS.find((item) => item.id === metric) ?? METRICS[0];
	const updated = atlasQuery.data ? ago(atlasQuery.data.fetchedAt) : "";
	function pick(country) {
		useAtlas.getState().setSelectedIso(country.id);
		requestFly(country.lon, country.lat, 4.2);
		if (window.matchMedia("(max-width: 767px)").matches) setSheet("places");
	}
	async function locate() {
		setLocStatus("locating");
		const gps = await new Promise((resolve) => {
			if (!navigator.geolocation) {
				resolve(null);
				return;
			}
			navigator.geolocation.getCurrentPosition((pos) => resolve(pos), () => resolve(null), {
				enableHighAccuracy: true,
				timeout: 1e4,
				maximumAge: 6e4
			});
		});
		if (gps) {
			setLocation({
				lat: gps.coords.latitude,
				lon: gps.coords.longitude,
				label: "Your position",
				at: Date.now(),
				approximate: false
			});
			requestFly(gps.coords.longitude, gps.coords.latitude, 5);
			setLocStatus("ready");
			return;
		}
		try {
			const body = await (await fetch("https://ipwho.is/")).json();
			if (body.success && typeof body.latitude === "number" && typeof body.longitude === "number") {
				setLocation({
					lat: body.latitude,
					lon: body.longitude,
					label: [body.city, body.country].filter(Boolean).join(", ") || "Approximate",
					at: Date.now(),
					approximate: true
				});
				requestFly(body.longitude, body.latitude, 4.6);
				setLocStatus("ready");
				return;
			}
		} catch {}
		setLocStatus("denied");
	}
	function toggleLayer(key) {
		const current = mergeLayers(prefs.layers);
		if (key === "owmTiles" && !prefs.owmKey) {
			setPrefsOpen(true);
			return;
		}
		patchPrefs({ layers: {
			...current,
			[key]: !current[key]
		} });
	}
	const showAlert = prefs.alertsOn && location && nearby.length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative h-dvh w-full overflow-hidden bg-bg text-cream",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HazardMap, {
				geo: geoQuery.data ?? null,
				countries: model?.countries ?? [],
				events: model?.events ?? [],
				volcanoes: volcanoQuery.data ?? null,
				radar: atlasQuery.data?.radar ?? null,
				frame,
				layers,
				owmKey: prefs.owmKey,
				radiusKm: prefs.radiusKm,
				location
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Desk, {
				radar: atlasQuery.data?.radar ?? null,
				frame
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-auto flex items-center gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-full border border-line bg-panel/90 px-3 py-2 backdrop-blur-md",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-2 font-display text-sm leading-tight tracking-wide sm:text-base",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "live-dot inline-block size-2 shrink-0 rounded-full bg-crimson",
								"aria-hidden": true
							}), APP_TITLE]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: updated ? `Live · ${updated}` : "Connecting feeds"
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-auto flex flex-wrap justify-end gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn hidden sm:inline-flex",
							onClick: () => nudgeZoom(.6),
							"aria-label": "Zoom in",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn hidden sm:inline-flex",
							onClick: () => nudgeZoom(-.6),
							"aria-label": "Zoom out",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn",
							onClick: () => void locate(),
							"aria-label": "Go to my location",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocateFixed, { className: locStatus === "locating" ? "size-4 animate-pulse" : "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn",
							onClick: () => void queryClient.invalidateQueries({ queryKey: ["atlas"] }),
							"aria-label": "Refresh feeds",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: atlasQuery.isFetching ? "size-4 animate-spin" : "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn",
							onClick: () => setLayersOpen((open) => !open),
							"aria-label": "Map layers",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn lg:hidden",
							onClick: () => setSheet(sheet === "agent" ? null : "agent"),
							"aria-label": "Open agent",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn",
							onClick: () => setPrefsOpen(true),
							"aria-label": "Preferences",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute inset-x-0 top-20 z-10 hidden text-center lg:block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-sm tracking-widest text-amber title-shadow",
					children: "WORLDWIDE"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-6xl leading-none text-cream title-shadow",
					children: metricMeta.kicker
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute left-3 top-20 z-20 hidden h-[calc(100%-6.5rem)] w-72 md:flex xl:w-80",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlacesDock, {
					countries: ranked,
					selected,
					sources: atlasQuery.data?.sources ?? [],
					loading: atlasQuery.isLoading || geoQuery.isLoading,
					error: atlasQuery.error instanceof Error ? atlasQuery.error.message : geoQuery.error instanceof Error ? geoQuery.error.message : null,
					onRetry: () => void atlasQuery.refetch(),
					nearby,
					onPick: pick,
					onAsk: (prompt) => {
						queuePrompt(prompt);
						if (window.matchMedia("(max-width: 1023px)").matches) setSheet("agent");
					}
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute right-3 top-20 z-20 hidden h-[calc(100%-6.5rem)] w-80 lg:flex",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopilotDock, {
					context,
					headlines: atlasQuery.data?.headlines ?? [],
					spaceWeather: atlasQuery.data?.spaceWeather ?? [],
					countries: model?.countries ?? [],
					metric
				})
			}),
			showAlert ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-x-3 top-20 z-30 md:left-80 md:right-auto md:w-80 lg:left-1/2 lg:w-96 lg:-translate-x-1/2",
				role: "status",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "w-full rounded-2xl border border-crimson bg-panel/95 px-3 py-2 text-left shadow-lg",
					onClick: () => {
						const first = nearby[0];
						if (!first) return;
						requestFly(first.event.lon, first.event.lat, 5.5);
						useAtlas.getState().setSelectedEventId(first.event.id);
						if (first.event.countryId) useAtlas.getState().setSelectedIso(first.event.countryId);
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-display text-lg leading-none tracking-wide text-amber",
							children: [
								nearby.length,
								" hazard",
								nearby.length === 1 ? "" : "s",
								" inside ",
								prefs.radiusKm,
								" km"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm",
							children: [
								"Closest: ",
								KIND_LABEL[nearby[0].event.kind],
								nearby[0].event.mag != null ? ` M${nearby[0].event.mag}` : "",
								" · ",
								Math.round(nearby[0].km),
								" km · ",
								nearby[0].event.title
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted",
							children: [location?.approximate ? "Approximate location. " : "", here.data ? `${weatherText(here.data.code)}${here.data.tempC != null ? ` · ${Math.round(here.data.tempC)}°C` : ""}` : location?.label]
						})
					]
				})
			}) : null,
			locStatus === "denied" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "absolute left-3 right-3 top-20 z-30 rounded-xl border border-line bg-panel px-3 py-2 text-sm md:left-80 md:max-w-sm",
				children: "Location is blocked. The world map still updates. Allow location to arm radius warnings, or try again."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-x-3 bottom-16 z-20 flex justify-center md:bottom-4 md:left-80 lg:right-96",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-md rounded-2xl border border-line bg-panel/90 p-3 backdrop-blur-md",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-2 flex gap-1 overflow-x-auto",
							children: METRICS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "chip shrink-0",
								"data-on": metric === item.id ? "true" : "false",
								onClick: () => setMetric(item.id),
								children: item.label
							}, item.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ramp" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex justify-between text-xs text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Quiet" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Extreme" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: metricMeta.blurb
						}),
						!prefs.hintDismissed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-muted",
							children: [
								"Feeds run without keys.",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-amber",
									onClick: () => setPrefsOpen(true),
									children: "Add OpenWeather or MiniMax"
								}),
								" ",
								"for station rain and the headline agent.",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-cream",
									onClick: () => patchPrefs({ hintDismissed: true }),
									children: "Hide"
								})
							]
						}) : null,
						aiLayer && aiLayer.metric === metric ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-amber",
							children: ["Agent blend on: ", aiLayer.note || "weights mixed with the live index."]
						}) : null,
						blendQuery.data?.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-crimson",
							children: blendQuery.data.error
						}) : null,
						prefs.owmKey && blendQuery.data && !blendQuery.data.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-cyan",
							children: [
								"OpenWeather rain blended into ",
								blendQuery.data.rows.length,
								" countries."
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex items-center justify-between text-xs text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { kind: "flood" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { kind: "quake" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { kind: "fire" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { kind: "storm" })
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "chip h-8 px-2",
								"data-on": radarPlay ? "true" : "false",
								onClick: () => setRadarPlay((play) => !play),
								children: ["Radar ", radarPlay ? "playing" : "paused"]
							})]
						})
					]
				})
			}),
			layersOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute right-3 top-20 z-40 w-64 rounded-2xl border border-line bg-panel p-3 shadow-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-xl leading-none",
							children: "Layers"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn h-9 w-9",
							onClick: () => setLayersOpen(false),
							"aria-label": "Close layers",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Country color",
								on: prefs.layers.choropleth,
								onClick: () => toggleLayer("choropleth")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Rain radar",
								on: prefs.layers.radar,
								onClick: () => toggleLayer("radar")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "OpenWeather tiles",
								on: prefs.layers.owmTiles,
								onClick: () => toggleLayer("owmTiles")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Quakes",
								on: prefs.layers.quakes,
								onClick: () => toggleLayer("quakes")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Floods",
								on: prefs.layers.floods,
								onClick: () => toggleLayer("floods")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Fires",
								on: prefs.layers.fires,
								onClick: () => toggleLayer("fires")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Storms",
								on: prefs.layers.storms,
								onClick: () => toggleLayer("storms")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Volcanoes",
								on: layers.volcanoes,
								onClick: () => toggleLayer("volcanoes")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Active faults",
								on: layers.faultsActive,
								onClick: () => toggleLayer("faultsActive")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Dormant faults",
								on: layers.faultsDormant,
								onClick: () => toggleLayer("faultsDormant")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Other hazards",
								on: layers.other,
								onClick: () => toggleLayer("other")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayerRow, {
								label: "Alert radius",
								on: layers.radius,
								onClick: () => toggleLayer("radius")
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: "Volcanoes are the Smithsonian Holocene catalog. Gold is erupting, orange erupted in the last 50 years, gray is dormant. Amber faults are active. Gray dashed faults last moved before the Holocene. GEM Global Active Faults."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: "Tiles use more of an OpenWeather quota than the 24-point blend."
					})
				]
			}) : null,
			prefsOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-40 flex items-end justify-center bg-bg/70 p-3 md:items-center",
				onClick: () => setPrefsOpen(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "dock w-full max-w-lg",
					onClick: (event) => event.stopPropagation(),
					role: "dialog",
					"aria-label": "Preferences",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsForm, { onClose: () => setPrefsOpen(false) })
				})
			}) : null,
			sheet ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-x-0 bottom-14 top-16 z-30 px-3 lg:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "dock h-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end border-b border-line px-2 py-1 lg:hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn h-9 w-9",
							onClick: () => setSheet(null),
							"aria-label": "Close panel",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-h-0 flex-1",
						children: [sheet === "places" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlacesDock, {
							countries: ranked,
							selected,
							sources: atlasQuery.data?.sources ?? [],
							loading: atlasQuery.isLoading,
							error: atlasQuery.error instanceof Error ? atlasQuery.error.message : null,
							onRetry: () => void atlasQuery.refetch(),
							nearby,
							onPick: pick,
							onAsk: (prompt) => {
								queuePrompt(prompt);
								setSheet("agent");
							}
						}) : null, sheet === "agent" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopilotDock, {
							context,
							headlines: atlasQuery.data?.headlines ?? [],
							spaceWeather: atlasQuery.data?.spaceWeather ?? [],
							countries: model?.countries ?? [],
							metric
						}) : null]
					})]
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "absolute inset-x-0 bottom-0 z-30 flex border-t border-line bg-panel pb-[max(0.4rem,env(safe-area-inset-bottom))] md:hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavButton, {
						label: "Places",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-4" }),
						on: sheet === "places",
						onClick: () => setSheet(sheet === "places" ? null : "places")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavButton, {
						label: "Agent",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-4" }),
						on: sheet === "agent",
						onClick: () => setSheet(sheet === "agent" ? null : "agent")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavButton, {
						label: "Prefs",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4" }),
						on: prefsOpen,
						onClick: () => setPrefsOpen(true)
					})
				]
			})
		]
	});
}
function Key({ kind }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "inline-flex items-center gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-2 rounded-full ${kind === "quake" ? "bg-crimson" : kind === "flood" ? "bg-cyan" : kind === "fire" ? "bg-fire" : "bg-storm"}` }), KIND_LABEL[kind]]
	});
}
function LayerRow({ label, on, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: "flex items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-panel-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: on ? "text-amber" : "text-muted",
			children: on ? "On" : "Off"
		})]
	});
}
function NavButton({ label, icon, on, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs",
		"data-on": on ? "true" : "false",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: on ? "text-amber" : "text-cream",
			children: icon
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: on ? "text-amber" : "text-muted",
			children: label
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AtlasApp, {});
}
//#endregion
export { Home as component };
