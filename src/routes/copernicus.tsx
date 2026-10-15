import { createFileRoute } from "@tanstack/react-router";
import { CopernicusApp } from "@/components/copernicus/CopernicusApp";

export const Route = createFileRoute("/copernicus")({
  head: () => ({
    meta: [
      { title: "Copernicus Mode · GWN" },
      {
        name: "description",
        content: "Live Copernicus ocean maps (sea temperature, currents, waves, sea ice, ocean life) with rain, air quality and river flow charts.",
      },
    ],
  }),
  component: CopernicusApp,
});
