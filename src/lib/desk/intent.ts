export type DeskIntent = {
  visual: boolean;
  radar: boolean;
  clouds: boolean;
  rain: boolean;
  place: string | null;
  chart: boolean;
  web: boolean;
};

function cleanPlace(raw: string): string | null {
  const cleaned = raw
    .split(/\b(?:of the|using|with live|showing)\b/i)[0]
    .replace(/[?.!]+$/g, "")
    .trim();
  if (!cleaned || /^(the\s+)?(clouds?|rain|rains|radar|doppler|weather|sky)$/i.test(cleaned)) return null;
  return cleaned.slice(0, 120);
}

export function readIntent(text: string): DeskIntent {
  const q = text.replace(/\s+/g, " ").trim();
  const clouds = /\b(clouds?|satellite)\b/i.test(q);
  const rainWord = /\b(doppler|radar|rain)\b/i.test(q);
  const chart = /\b(chart|charts|graph|stats|statistics|plot)\b/i.test(q);
  const web = /\b(web ?search|search the web|look up|webpage|web page|article|wikipedia)\b/i.test(q);
  const mapOf = q.match(/\bmap of\s+(.+)/i);
  const weatherIn = q.match(/\bweather\s+(?:in|for|at|around|over|near)\s+(.+)/i);
  const radarOf = q.match(/\bradar\s+(?:of|over|for|in|around|near)\s+(.+)/i);
  const place = cleanPlace(mapOf?.[1] || weatherIn?.[1] || radarOf?.[1] || "");
  const rain = rainWord || (!!place && !clouds);
  const radar = rain || clouds || !!place;
  return {
    visual: radar || chart || web || !!place,
    radar,
    clouds,
    rain,
    place,
    chart,
    web,
  };
}
