import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dayStamp, defaultSettings, featureInfoUrl, isCmemsUrl, LAYER_BY_ID, LAYERS, styleString, tilePixel, tileTemplate } from "./layers.ts";

describe("Copernicus layer catalogue", () => {
  it("has unique ids and product/dataset/variable layer paths", () => {
    assert.equal(new Set(LAYERS.map((layer) => layer.id)).size, LAYERS.length);
    for (const layer of LAYERS) assert.equal(layer.layer.split("/").length, 3, layer.id);
  });
});

describe("tileTemplate", () => {
  it("keeps MapLibre placeholders and adds time, depth and style", () => {
    const sst = LAYER_BY_ID.get("sst")!;
    const url = tileTemplate(sst, defaultSettings(sst), "2026-10-15", 47.37369);
    assert.ok(url.includes("TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"));
    assert.ok(url.includes("time=2026-10-15T00%3A00%3A00Z"));
    assert.ok(url.includes("elevation=-47.37369"));
    assert.ok(isCmemsUrl(url));
  });

  it("stamps 3-hourly waves at noon and never sends a depth for 2-D layers", () => {
    const waves = LAYER_BY_ID.get("wave-height")!;
    const url = tileTemplate(waves, defaultSettings(waves), "2026-10-15", 100);
    assert.ok(url.includes("time=2026-10-15T12%3A00%3A00Z"));
    assert.ok(!url.includes("elevation"));
  });
});

describe("styleString", () => {
  it("encodes filters the way the WMTS expects", () => {
    const cur = LAYER_BY_ID.get("currents")!;
    const style = styleString(cur, { ...defaultSettings(cur), range: [0, 2], onlyInRange: true, arrows: true });
    assert.equal(style, "cmap:speed,range:0/2,noClamp,vectorStyle:solidAndVector");
  });
});

describe("tilePixel / featureInfoUrl", () => {
  it("matches the Copernicus help-centre GetFeatureInfo example tile", () => {
    // Their example: tilematrix=10, tilerow=391, tilecol=530 covers 39.08°N 6.58°E.
    const { col, row } = tilePixel(6.5833, 39.0833, 10);
    assert.equal(col, 530);
    assert.equal(row, 391);
  });

  it("only allows the Copernicus host through the tile relay", () => {
    assert.ok(isCmemsUrl(featureInfoUrl("A/B/c", 0, 0, dayStamp(0))));
    assert.ok(!isCmemsUrl("https://evil.example/teroWmts"));
    assert.ok(!isCmemsUrl("http://wmts.marine.copernicus.eu/teroWmts"));
  });
});
