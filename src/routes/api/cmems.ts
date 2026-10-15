import { createFileRoute } from "@tanstack/react-router";

// Same-origin relay for Copernicus Marine tiles, used only if the browser blocks the direct request.
export const Route = createFileRoute("/api/cmems")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("u") ?? "";
        const { proxyTile } = await import("@/lib/copernicus/data.server");
        return proxyTile(target);
      },
    },
  },
});
