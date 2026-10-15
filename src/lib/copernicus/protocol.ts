export const CMEMS_PROTOCOL = "cmems";

/** Route a Copernicus tile template through our protocol so a blocked request can fall back to the relay. */
export function protocolTiles(url: string): string {
  return `${CMEMS_PROTOCOL}://${url}`;
}

let ready = false;
// Flips once a direct request is blocked (CORS / network), then every tile uses the same-origin relay.
let viaRelay = false;

async function fetchTile(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  if (!viaRelay) {
    try {
      const res = await fetch(url, { signal, mode: "cors" });
      if (!res.ok) throw new Error(`Copernicus tile HTTP ${res.status}`);
      return await res.arrayBuffer();
    } catch (err) {
      // A TypeError is how browsers report a blocked cross-origin request; HTTP errors are real.
      if (!(err instanceof TypeError)) throw err;
      viaRelay = true;
    }
  }
  const res = await fetch(`/api/cmems?u=${encodeURIComponent(url)}`, { signal });
  if (!res.ok) throw new Error(`Copernicus relay HTTP ${res.status}`);
  return res.arrayBuffer();
}

export function registerCmemsProtocol(lib: typeof import("maplibre-gl")) {
  if (ready) return;
  ready = true;
  lib.addProtocol(CMEMS_PROTOCOL, async (params, abortController) => {
    const url = params.url.slice(`${CMEMS_PROTOCOL}://`.length);
    return { data: await fetchTile(url, abortController.signal) };
  });
}
