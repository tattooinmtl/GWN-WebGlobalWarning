import { a as weatherText } from "./format-CIOAsVLu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plan.server--FC_FjJC.js
var UA = "GWNAtlas/0.0.8 (educational live hazard map)";
async function getJson(url) {
	try {
		const res = await fetch(url, {
			headers: {
				Accept: "application/json",
				"User-Agent": UA
			},
			signal: AbortSignal.timeout(8e3)
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}
async function geocode(query) {
	const body = await getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
	const row = Array.isArray(body) ? body[0] : void 0;
	const lat = Number(row?.lat);
	const lon = Number(row?.lon);
	if (!row || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	return {
		name: row.display_name || query,
		lat,
		lon
	};
}
async function weatherAt(lat, lon) {
	const current = (await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m&timezone=auto`))?.current;
	if (!current) return null;
	return {
		tempC: typeof current.temperature_2m === "number" ? current.temperature_2m : null,
		rain: typeof current.rain === "number" ? current.rain : typeof current.precipitation === "number" ? current.precipitation : null,
		wind: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null,
		code: typeof current.weather_code === "number" ? current.weather_code : null
	};
}
async function wiki(title) {
	const body = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
	if (!body || body.type === "disambiguation" || !body.extract) return null;
	const page = body.content_urls?.desktop?.page;
	return {
		extract: body.extract.slice(0, 520),
		url: page || ""
	};
}
function note(links, label, status, detail, url = "") {
	links.push({
		label,
		url,
		status,
		detail
	});
}
async function buildDesk(input) {
	const links = [];
	const geo = input.place ? await geocode(input.place) : null;
	if (input.place) note(links, "Place search", geo ? "found" : "empty", geo ? `Nominatim matched “${input.place}” to ${geo.name}. Point ${geo.lat.toFixed(3)}, ${geo.lon.toFixed(3)}.` : `Nominatim returned nothing for “${input.place}”.`, geo ? `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lon}#map=11/${geo.lat}/${geo.lon}` : "");
	const lat = geo?.lat ?? input.centerLat;
	const lon = geo?.lon ?? input.centerLon;
	const hasPoint = lat != null && lon != null;
	let meteo = null;
	if (hasPoint && (input.wantRadar || input.wantRain || geo)) {
		meteo = await weatherAt(lat, lon);
		note(links, "Open-Meteo", meteo ? "found" : "empty", meteo ? `${weatherText(meteo.code)}. Temperature ${meteo.tempC == null ? "n/a" : `${Math.round(meteo.tempC)}°C`}. Rain ${meteo.rain == null ? "n/a" : `${meteo.rain} mm`}. Wind ${meteo.wind == null ? "n/a" : `${Math.round(meteo.wind)} km/h`}.` : "Open-Meteo returned no current reading for this point.", "https://open-meteo.com/");
	}
	const showClouds = input.wantClouds;
	const showRain = input.wantRain || input.wantRadar && !showClouds || !!geo;
	if (showRain) {
		const frames = input.radarFrames;
		note(links, "RainViewer radar", frames > 0 ? "found" : "empty", frames > 0 ? `${frames} recent radar frames are already loaded. The window paints the newest one over about 100 km.` : "RainViewer had no radar frames loaded, so the window has no rain picture.", frames > 0 ? "https://www.rainviewer.com/map.html" : "");
	}
	if (showClouds) note(links, "GOES clouds", input.cloudTime ? "found" : "empty", input.cloudTime ? `NASA GIBS has a GOES GeoColor frame at ${input.cloudTime}. That picture is drawn under the radar.` : "No GOES cloud frame was available, so no satellite picture was attached.", input.cloudTime ? "https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" : "");
	let page = null;
	if (input.wantWeb) {
		const topic = geo?.name.split(",")[0]?.trim() || input.question.replace(/^(please\s+)?(show|open|find|search|look up)(\s+me)?(\s+a)?(\s+the)?(\s+web page|\s+page|\s+article|\s+wikipedia)?(\s+about|\s+of|\s+for|\s+on)?\s+/i, "").trim();
		page = topic ? await wiki(topic.slice(0, 80)) : null;
		note(links, "Wikipedia", page ? "found" : "empty", page ? page.extract : `Wikipedia had no summary for “${topic || input.question}”.`, page?.url || "");
	}
	if (input.wantChart) {
		const top = input.bars.slice(0, 8);
		note(links, "Live map scores", top.length ? "found" : "empty", top.length ? `Chart uses the ${input.unit || "live"} scores already on the map: ${top.map((bar) => `${bar.label} ${Math.round(bar.value)}`).join(", ")}.` : "No country scores were on the map, so there is nothing to chart.");
	}
	const windows = [];
	if (input.wantRadar || geo) {
		const title = geo ? geo.name.split(",").slice(0, 2).join(",") : showClouds && !showRain ? "Clouds" : "Live radar";
		windows.push({
			kind: geo ? "place" : "radar",
			title,
			lat,
			lon,
			radiusKm: geo ? 100 : null,
			showRain,
			showClouds,
			summary: geo ? `About 100 km around ${geo.name.split(",").slice(0, 2).join(",")}.` : showClouds ? "Cloud picture with radar when rain is on." : "Live radar.",
			pageUrl: geo ? `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lon}#map=11/${geo.lat}/${geo.lon}` : null,
			weather: meteo,
			bars: [],
			unit: "",
			sources: links
		});
	}
	if (input.wantChart && input.bars.length) windows.push({
		kind: "chart",
		title: `${input.unit || "Live"} scores`,
		lat: null,
		lon: null,
		radiusKm: null,
		showRain: false,
		showClouds: false,
		summary: "Bars are the live country scores already on the map.",
		pageUrl: null,
		weather: null,
		bars: input.bars.slice(0, 8),
		unit: input.unit,
		sources: links
	});
	if (input.wantWeb) windows.push({
		kind: "web",
		title: page?.url ? geo?.name.split(",")[0] || "Web result" : "Web result",
		lat: null,
		lon: null,
		radiusKm: null,
		showRain: false,
		showClouds: false,
		summary: page?.extract || "Sorry no info could be retrieved from web search.",
		pageUrl: page?.url || null,
		weather: null,
		bars: [],
		unit: "",
		sources: links
	});
	const where = geo ? geo.name.split(",").slice(0, 2).join(",") : input.place;
	return {
		note: geo ? `Opened a 100 km live view of ${where}.` : input.place ? `OpenStreetMap did not find “${input.place}”.` : windows.length ? "Opened a live window from the current feeds." : "",
		windows
	};
}
//#endregion
export { buildDesk };
