# Spec — Copernicus Mode (V.0.2.0)

Status: **BUILT** (approved 2026-10-15) · Branch: `tattooai/sharp-johnson-9w61sm`

## Goal
A separate page, `/copernicus`, that only shows Copernicus data. It has its own interface: a big ocean map, toggleable layers, a time slider, click-for-value, and small charts.
The main page stays untouched apart from one new "Copernicus mode" button.

## Verified data access (tested 2026-10-15, no account, no key)
| What | Endpoint | Result |
|---|---|---|
| Map tiles | `wmts.marine.copernicus.eu/teroWmts?REQUEST=GetTile…` (EPSG:3857, 256/512 px) | ✅ image |
| Value at a clicked point | `…REQUEST=GetFeatureInfo…&INFOFORMAT=application/json` | ✅ `24.09 °C` JSON |
| Legend (min/max/colors/units) | `…REQUEST=GetLegend…&FORMAT=application/json` | ✅ JSON |
| Layer list + time steps | `…/teroWmts/<PRODUCT>?REQUEST=GetCapabilities` | ✅ XML (waves: every 3 h, to +9 days) |

Risk: I could not check the CORS headers from the sandbox. If the browser blocks them, tiles and values go through our own server route (`/api/cmems/*`). That is a few lines of code and still free.

## Layers (menus grouped by data type)
**🌡 Temperature** — GLOBAL_ANALYSISFORECAST_PHY_001_024
- Sea surface temp (`thetao`, daily, depth selector 0 m → 5000 m)
- SST anomaly vs normal (`sst-anomaly`)

**🌊 Currents & sea level**
- Surface currents speed + arrows (`sea_water_velocity`, vectorStyle)
- Sea level (`zos`)
- Mixed layer depth (`mlotst`)

**🧂 Salinity** — `so`

**🌊 Waves** — GLOBAL_ANALYSISFORECAST_WAV_001_027 (3-hourly)
- Wave height (`VHM0`), swell, wave period, max wave height

**❄️ Sea ice** — ice concentration + thickness (`siconc`, `sithick`)

**🌱 Ocean life** — GLOBAL_ANALYSISFORECAST_BGC_001_028: chlorophyll, oxygen

**🌧 Atmosphere (Copernicus/ECMWF via Open-Meteo, free and keyless)**
- **Rain in mm**: hourly precipitation, sum for the next 24 h, and a 7-day chart at the clicked point (ECMWF IFS model)
- Air quality (Copernicus CAMS): PM2.5, ozone, dust, UV
- River flood discharge (Copernicus GloFAS)

These appear as charts in the side panel for the clicked point. They have no free tile layer.

The Copernicus Climate Data Store (ERA5) needs an account and runs about 5 days late, so it is **left out**.

## UI (simple)
- **Top bar**: "COPERNICUS MODE" title, ← back to GWN, date/time slider with ▶ play.
- **Left drawer**: data-type menus (accordion). Each layer has an on/off switch and an opacity slider. Depth appears only for 3-D layers.
- **Filters**: show values only between min and max (WMTS `range:` + `noClamp`), color scheme picker, depth.
- **Click on map** → right panel with the value of every active layer at that point, plus charts:
  - sea temp over the next 10 days
  - waves over the next 9 days
  - rain mm over 7 days
  - air quality
- **Legends**: auto-built from GetLegend so they always match the map.
- **Mobile**: drawers become bottom sheets.
- Basemap: same free chain as the main map (Esri → NASA Blue Marble → OSM).

## Main page change (the only one)
- One button in the header, **"Copernicus mode"**: a squared tile (radius 6 px, not a pill), yellow→orange→red gradient (`amber #f5c518 → fire #ff8a2a → crimson #e23b4a`) with a subtle glow and a wave icon. It links to `/copernicus`.
- No other edits to `AtlasApp.tsx` / `HazardMap.tsx`.

## Files (all new except one line in AtlasApp)
- `src/routes/copernicus.tsx` — page route
- `src/components/copernicus/*` — CopernicusApp, LayerMenu, PointPanel, Charts, TimeBar
- `src/lib/copernicus/layers.ts` — layer catalogue (product/dataset/variable/style)
- `src/lib/copernicus/wmts.ts` — tile URL, GetFeatureInfo, GetLegend, time list
- `src/lib/copernicus/openmeteo.ts` — rain mm / air / flood fetchers
- reuse: `BASEMAPS` / base fallback from HazardMap (extract to a shared module, behavior unchanged)

## Decisions
1. Separate route keeps the live site safe. ✅
2. Only free, keyless sources. ✅
3. Rain mm comes from ECMWF via Open-Meteo, not the CDS (needs an account and isn't live). ✅
4. Charts use `recharts`, which was already installed, so no new dependency. ✅
5. Version bumped to V.0.2.0. ✅

## Verification
Typecheck, build, and Playwright smoke tests (desktop and mobile) with mocked Copernicus responses, plus a TinyFish check of real tile URLs before merge.
6. Depth is one shared filter in the time bar (it applies to every 3-D layer and to the spot values). ✅
7. Tiles load straight from Copernicus. If the browser blocks that, they switch to the `/api/cmems` relay, which only accepts the Copernicus host. ✅
8. Playback moves to the next day only after the map has finished drawing the current one (the same lesson as the radar fix). ✅
9. Waves are 3-hourly, so the slider shows them at 12:00 UTC; the daily layers use 00:00 UTC. ✅

## Results
- Real Copernicus URLs built by the code (tiles, values at depth, legends) were checked live: all return data.
- Unit tests: `src/lib/copernicus/layers.test.ts`, 6 passing.
- Browser runs with mocked data (dev and production build, desktop and phone): layers toggle, filters, spot panel and charts work; play steps through days; no console errors; no sideways scroll on a phone.
