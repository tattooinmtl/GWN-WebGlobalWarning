import { createFileRoute } from "@tanstack/react-router";
import { GlobeApp } from "@/components/globe/GlobeApp";

export const Route = createFileRoute("/globe")({
  head: () => ({
    meta: [
      { title: "3D Globe · GWN" },
      {
        name: "description",
        content:
          "Live 3D globe: real-time day/night line and Moon, satellite clouds and radar, earthquake heatmap, faults, Copernicus layers and a last-hour hazard feed.",
      },
    ],
  }),
  component: GlobeApp,
});
