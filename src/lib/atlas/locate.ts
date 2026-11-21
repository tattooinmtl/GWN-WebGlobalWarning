import type { UserLocation } from "./store";

type IpWho = {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
};

/**
 * Browser geolocation, then ipwho.is if GPS is missing or denied.
 * Does not prompt on its own — call only from a locate button.
 */
export async function locateUser(): Promise<UserLocation | null> {
  const gps = await new Promise<GeolocationPosition | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  });
  if (gps) {
    return {
      lat: gps.coords.latitude,
      lon: gps.coords.longitude,
      label: "Your position",
      at: Date.now(),
      approximate: false,
    };
  }
  try {
    const res = await fetch("https://ipwho.is/");
    const body = (await res.json()) as IpWho;
    if (body.success && typeof body.latitude === "number" && typeof body.longitude === "number") {
      return {
        lat: body.latitude,
        lon: body.longitude,
        label: [body.city, body.country].filter(Boolean).join(", ") || "Approximate",
        at: Date.now(),
        approximate: true,
      };
    }
  } catch {
    /* GPS and network location both failed */
  }
  return null;
}

/** Sun altitude in degrees at a lat/lon, given the subsolar point. Positive = above the horizon. */
export function solarAltitudeDeg(lat: number, lon: number, sunLat: number, sunLon: number): number {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  const sla = (sunLat * Math.PI) / 180;
  const slo = (sunLon * Math.PI) / 180;
  const sinAlt = Math.sin(la) * Math.sin(sla) + Math.cos(la) * Math.cos(sla) * Math.cos(lo - slo);
  return (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;
}
