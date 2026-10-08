import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-Gzg65sQG.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function cleanKey(value, max) {
	if (typeof value !== "string") return "";
	return value.trim().slice(0, max);
}
var loadAtlas_createServerFn_handler = createServerRpc({
	id: "ec41fa023681aa3f1c4ba78e7a8c9992c151a8c92049f40b3dcf9cd5c82d6be8",
	name: "loadAtlas",
	filename: "src/lib/disasters/api.ts"
}, (opts) => loadAtlas.__executeServer(opts));
var loadAtlas = createServerFn({ method: "POST" }).validator((input) => ({ nasaKey: cleanKey(input?.nasaKey, 80) })).handler(loadAtlas_createServerFn_handler, async ({ data }) => {
	const { loadAtlasData } = await import("./feeds.server-DRJSydD4.mjs");
	return loadAtlasData(data.nasaKey);
});
var pointForecast_createServerFn_handler = createServerRpc({
	id: "0ddf41afaeebcd1a69115050ea2b887d0809cf7d9496e7ff77da4de726156030",
	name: "pointForecast",
	filename: "src/lib/disasters/api.ts"
}, (opts) => pointForecast.__executeServer(opts));
var pointForecast = createServerFn({ method: "POST" }).validator((input) => {
	const lat = Number(input?.lat);
	const lon = Number(input?.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Bad coordinates");
	return {
		lat,
		lon,
		owmKey: cleanKey(input?.owmKey, 80)
	};
}).handler(pointForecast_createServerFn_handler, async ({ data }) => {
	const { loadPointForecast } = await import("./feeds.server-DRJSydD4.mjs");
	return loadPointForecast(data.lat, data.lon, data.owmKey);
});
var blendOpenWeather_createServerFn_handler = createServerRpc({
	id: "454cccdcfeb040d1f3a9242fce4e5725a0a6ca28328133503d6799ed2bec4920",
	name: "blendOpenWeather",
	filename: "src/lib/disasters/api.ts"
}, (opts) => blendOpenWeather.__executeServer(opts));
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
}).handler(blendOpenWeather_createServerFn_handler, async ({ data }) => {
	const { loadOwmBlend } = await import("./feeds.server-DRJSydD4.mjs");
	return loadOwmBlend(data.owmKey, data.points);
});
var askAnalyst_createServerFn_handler = createServerRpc({
	id: "c38c8e9e18bd233369150c48d6ed2e252e6e7c9f08b0419c964ca455e68461f8",
	name: "askAnalyst",
	filename: "src/lib/disasters/api.ts"
}, (opts) => askAnalyst.__executeServer(opts));
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
}).handler(askAnalyst_createServerFn_handler, async ({ data }) => {
	const { runAnalyst } = await import("./ai.server-CBEQulbl.mjs");
	return runAnalyst(data);
});
var openDeskView_createServerFn_handler = createServerRpc({
	id: "b981a0b191d0a2ad9b5ebc9fd77a261776544e08991b69d93b27d77c12c495b7",
	name: "openDeskView",
	filename: "src/lib/disasters/api.ts"
}, (opts) => openDeskView.__executeServer(opts));
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
		centerLon: Number.isFinite(lon) && Math.abs(lon) <= 180 ? lon : null,
		radarFrames: Number.isFinite(Number(input?.radarFrames)) ? Math.max(0, Math.round(Number(input?.radarFrames))) : 0,
		cloudTime: typeof input?.cloudTime === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(input.cloudTime) ? input.cloudTime : null
	};
}).handler(openDeskView_createServerFn_handler, async ({ data }) => {
	const { buildDesk } = await import("./plan.server--FC_FjJC.mjs");
	return buildDesk(data);
});
//#endregion
export { askAnalyst_createServerFn_handler, blendOpenWeather_createServerFn_handler, loadAtlas_createServerFn_handler, openDeskView_createServerFn_handler, pointForecast_createServerFn_handler };
