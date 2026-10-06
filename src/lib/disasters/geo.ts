import type { AlertLevel, CountryCollection, HazardKind } from "./types";

export type PrepCountry = {
  id: string;
  name: string;
  iso2: string;
  continent: string;
  pop: number;
  lon: number;
  lat: number;
  bbox: [number, number, number, number];
  wide: boolean;
  rings: [number, number][][];
};

const EMPTY_COUNTS = (): Record<HazardKind, number> => ({
  quake: 0,
  flood: 0,
  fire: 0,
  storm: 0,
  volcano: 0,
  drought: 0,
  landslide: 0,
  other: 0,
});

export { EMPTY_COUNTS };

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a1 = (lat1 * Math.PI) / 180;
  const a2 = (lat2 * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function circleRing(lon: number, lat: number, km: number, steps = 72): [number, number][] {
  const R = 6371;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const δ = km / R;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = (i / steps) * 2 * Math.PI;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
      );
    ring.push([((λ2 * 180) / Math.PI + 540) % 360 - 180, (φ2 * 180) / Math.PI]);
  }
  return ring;
}

function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function outers(geometry: { type: string; coordinates: unknown }): [number, number][][] {
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates as number[][][];
    const ring = coords[0];
    return ring ? [ring.map((p) => [p[0], p[1]] as [number, number])] : [];
  }
  if (geometry.type === "MultiPolygon") {
    const coords = geometry.coordinates as number[][][][];
    return coords
      .map((poly) => poly[0])
      .filter(Boolean)
      .map((ring) => ring.map((p) => [p[0], p[1]] as [number, number]));
  }
  return [];
}

export function prepareCountries(fc: CountryCollection): PrepCountry[] {
  const prep: PrepCountry[] = [];
  for (const feature of fc.features) {
    const p = feature.properties;
    const rings = outers(feature.geometry);
    if (!rings.length || !p?.id) continue;
    let minLon = 180;
    let minLat = 90;
    let maxLon = -180;
    let maxLat = -90;
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
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
      bbox: [minLon, minLat, maxLon, maxLat],
      wide,
      rings,
    });
  }
  prep.sort((a, b) => {
    const aa = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
    const bb = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
    return aa - bb;
  });
  return prep;
}

export function locateCountry(prep: PrepCountry[], lon: number, lat: number): PrepCountry | null {
  for (const country of prep) {
    if (!country.wide) {
      const [minLon, minLat, maxLon, maxLat] = country.bbox;
      if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    }
    for (const ring of country.rings) {
      if (pointInRing(lon, lat, ring)) return country;
    }
  }
  return null;
}

const ALERT_RANK: Record<AlertLevel, number> = { info: 0, green: 1, orange: 2, red: 3 };

export function strongerAlert(a: AlertLevel, b: AlertLevel): AlertLevel {
  return ALERT_RANK[a] >= ALERT_RANK[b] ? a : b;
}
