//#region node_modules/.nitro/vite/services/ssr/assets/plan.server-BMlPKVK0.js
var UA = "GWNAtlas/0.0.4 (educational live hazard map)";
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
function pushLink(links, label, url) {
	if (!url || links.some((link) => link.url === url)) return;
	links.push({
		label,
		url
	});
}
async function buildDesk(input) {
	const links = [];
	pushLink(links, "OpenStreetMap", "https://www.openstreetmap.org/copyright");
	const geo = input.place ? await geocode(input.place) : null;
	const lat = geo?.lat ?? input.centerLat;
	const lon = geo?.lon ?? input.centerLon;
	const hasPoint = lat != null && lon != null;
	if (geo) pushLink(links, geo.name, `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lon}#map=10/${geo.lat}/${geo.lon}`);
	let meteo = null;
	if (hasPoint && (input.wantRadar || geo)) {
		meteo = await weatherAt(lat, lon);
		pushLink(links, "Open-Meteo forecast", "https://open-meteo.com/");
	}
	const topic = geo?.name.split(",")[0]?.trim() || (input.wantWeb ? input.question.replace(/^(please\s+)?(show|open|find|search|look up)(\s+me)?(\s+a)?(\s+the)?(\s+web page|\s+page|\s+article|\s+wikipedia)?(\s+about|\s+of|\s+for|\s+on)?\s+/i, "").trim() : "");
	const page = topic ? await wiki(topic.slice(0, 80)) : null;
	if (page?.url) pushLink(links, "Wikipedia", page.url);
	const showClouds = input.wantClouds;
	const showRain = input.wantRain || input.wantRadar && !showClouds || !!geo;
	if (showRain) pushLink(links, "RainViewer radar", "https://www.rainviewer.com/api.html");
	if (showClouds) pushLink(links, "NASA GIBS GOES GeoColor", "https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs");
	if (input.wantChart) {
		pushLink(links, "USGS earthquakes", "https://earthquake.usgs.gov/earthquakes/feed/");
		pushLink(links, "Earthquakes Canada", "https://www.earthquakescanada.nrcan.gc.ca/recent/index-en.php");
		pushLink(links, "CWFIS wildfires", "https://cwfis.cfs.nrcan.gc.ca/");
		pushLink(links, "Environment Canada alerts", "https://weather.gc.ca/warnings/index_e.html");
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
			summary: geo ? `About 100 km around ${geo.name}. Base map is OpenStreetMap. Rain is RainViewer.${showClouds ? " Clouds are NASA GOES." : ""}` : showClouds ? "NASA GOES GeoColor clouds, with RainViewer radar when rain is on." : "RainViewer radar on an OpenStreetMap base.",
			pageUrl: geo ? `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lon}#map=10/${geo.lat}/${geo.lon}` : "https://www.rainviewer.com/map.html",
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
		summary: "Bars are the live country scores already on the map. They are not a forecast.",
		pageUrl: null,
		weather: null,
		bars: input.bars.slice(0, 8),
		unit: input.unit,
		sources: links
	});
	if (input.wantWeb) {
		const summary = page?.extract || (geo ? `No encyclopedia extract for ${geo.name}. The map window uses OpenStreetMap, RainViewer, and Open-Meteo.` : "Links are the feeds used for this answer. Open any of them in this new page.");
		windows.push({
			kind: "web",
			title: page?.url ? topic.slice(0, 80) : "Web result",
			lat: null,
			lon: null,
			radiusKm: null,
			showRain: false,
			showClouds: false,
			summary,
			pageUrl: page?.url || links[1]?.url || links[0]?.url || null,
			weather: null,
			bars: [],
			unit: "",
			sources: links
		});
	}
	const where = geo ? geo.name.split(",").slice(0, 2).join(",") : input.place;
	return {
		note: geo ? `Opened a 100 km live view of ${where}.` : input.place ? `OpenStreetMap did not find “${input.place}”. I opened what the other feeds can show.` : windows.length ? "Opened a live window from the current feeds." : "",
		windows
	};
}
//#endregion
export { buildDesk };
