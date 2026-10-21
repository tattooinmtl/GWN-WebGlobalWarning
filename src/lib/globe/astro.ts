import {
  Body,
  EquatorFromVector,
  GeoVector,
  Illumination,
  MoonPhase,
  RotateVector,
  Rotation_EQJ_EQD,
  SiderealTime,
  KM_PER_AU,
} from "astronomy-engine";

/** A body's position in the Earth-fixed frame: the point it is straight overhead, plus distance. */
export type SubPoint = { lat: number; lon: number; distKm: number };

function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Geocentric apparent position of a body (true equator & equinox of date), turned Earth-fixed via GAST. */
function subPoint(body: Body, date: Date): SubPoint {
  const eqj = GeoVector(body, date, true);
  const eqd = RotateVector(Rotation_EQJ_EQD(date), eqj);
  const eq = EquatorFromVector(eqd);
  const gast = SiderealTime(date); // sidereal hours
  return { lat: eq.dec, lon: wrapLon((eq.ra - gast) * 15), distKm: eq.dist * KM_PER_AU };
}

export type SkyState = {
  time: Date;
  sun: SubPoint;
  moon: SubPoint;
  /** 0 = new, 90 = first quarter, 180 = full, 270 = last quarter (ecliptic elongation, degrees). */
  moonPhaseDeg: number;
  /** Fraction of the Moon's disc lit, 0..1. */
  moonLit: number;
  moonPhaseName: string;
};

export function phaseName(deg: number): string {
  const names = [
    "New Moon",
    "Waxing crescent",
    "First quarter",
    "Waxing gibbous",
    "Full Moon",
    "Waning gibbous",
    "Last quarter",
    "Waning crescent",
  ];
  return names[Math.round(deg / 45) % 8];
}

export function skyAt(date: Date): SkyState {
  const phase = MoonPhase(date);
  return {
    time: date,
    sun: subPoint(Body.Sun, date),
    moon: subPoint(Body.Moon, date),
    moonPhaseDeg: phase,
    moonLit: Illumination(Body.Moon, date).phase_fraction,
    moonPhaseName: phaseName(phase),
  };
}

/** Earth-fixed unit vector used by the globe: +Y north pole, lon 0 on +X, lon 90E on -Z. */
export function latLonToXYZ(lat: number, lon: number, r = 1): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

export function xyzToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.hypot(x, y, z) || 1;
  return { lat: (Math.asin(y / r) * 180) / Math.PI, lon: (Math.atan2(-z, x) * 180) / Math.PI };
}

export function formatLatLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
}
