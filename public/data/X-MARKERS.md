# `public/data/x-markers.json` — markers for the 3D globe (`/globe`)

The globe page loads this file on start and every 5 minutes, and draws each entry as a pulsing marker
next to the live feeds (USGS, GDACS, NASA EONET, NWS, Smithsonian, Canada). A daily X (Twitter) scan
is meant to overwrite it; until then it is empty.

## Shape

Either a bare array of markers, or an object with a `markers` array (recommended):

```json
{
  "updated": "2026-10-21T06:00:00Z",
  "source": "daily X scan",
  "markers": [
    {
      "id": "x-2026-10-21-001",
      "title": "Reports of flooding in Valencia old town",
      "lat": 39.47,
      "lon": -0.376,
      "level": "orange",
      "type": "flood",
      "source_url": "https://x.com/someone/status/1234567890",
      "time": "2026-10-21T05:42:00Z"
    }
  ]
}
```

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | Unique and stable across scans (it is prefixed with `x:` on the globe). |
| `title` | string | yes | Shown in the feed and the popup (cut at 200 chars). |
| `lat` | number | yes | −90…90, WGS84 degrees. |
| `lon` | number | yes | −180…180, WGS84 degrees. |
| `level` | `"green" \| "yellow" \| "orange" \| "red"` | yes | Controls color, size and pulse speed. Unknown → `yellow`. |
| `type` | string | no | `quake`, `flood`, `fire`, `storm`, `volcano`, `drought`, `landslide`, `cyber`, or anything else (shown as `x`/other). |
| `source_url` | string | no | Must start with `http(s)://` to be linked. |
| `time` | ISO 8601 string | no | UTC. Used by the "last hour / 6 h / 24 h" feed filter. Missing → load time. |

## `type: "cyber"` — cyber attacks

Cyber attacks (ransomware, DDoS, breaches, attacks on infrastructure) use the same row shape with
`"type": "cyber"`. `lat`/`lon` is the location of the targeted organization (its HQ or the affected
site) or, when only the country is known, that country's capital/centroid. `level` reflects impact
(`red` = critical infrastructure or national-scale outage, `orange` = major organization disrupted,
`yellow` = confirmed attack/breach, `green` = claimed or minor). Example:

```json
{
  "id": "x-2026-11-18-cyber-example-hospital",
  "title": "Ransomware attack disrupts Example Hospital systems",
  "lat": 43.65, "lon": -79.38,
  "level": "orange",
  "type": "cyber",
  "source_url": "https://example.com/news/article",
  "time": "2026-11-18T04:10:00Z"
}
```

Where they show up:

- **Main page 2D map (`/`)**: magenta (`#d000ff`) markers only, toggled by **Layers → Cyber attacks**,
  with a "Cyber attack" entry in the legend. Hover/click shows title, level, time and source link.
  The page re-reads this file every 5 minutes (`src/lib/atlas/cyber.ts`).
- **3D globe (`/globe`)**: drawn into the heat map layer ("Heatmap: quakes (30 days) + cyber attacks")
  in magenta on top of the quake heat, and as magenta markers with the X scan markers.

An empty file or no `cyber` rows simply shows nothing.

Rows that fail validation are skipped silently (see `parseXMarkers` in `src/lib/globe/events.ts`).
Because it is a static file in `public/`, a new version needs a commit + deploy (or move it to a
storage URL later and point `X_MARKERS_URL` in `src/components/globe/GlobeApp.tsx` at it).
