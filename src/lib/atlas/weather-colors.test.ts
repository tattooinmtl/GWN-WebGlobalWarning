import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recolorPixel, RAIN_STOPS, SNOW_STOPS } from "./weather-colors.ts";

const rgb = (packed: number) => [packed >>> 24, (packed >>> 16) & 255, (packed >>> 8) & 255];
const alpha = (packed: number) => packed & 255;
const hex = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
// Purple-ish: blue channel clearly above green (snow palette); rain palette never does that.
const isSnowColor = (packed: number) => {
  const [r, g, b] = rgb(packed);
  return b > g + 15 && r > g - 10;
};

describe("recolorPixel (RainViewer Universal Blue)", () => {
  it("paints rain blue/yellow/red source colors with the rain palette", () => {
    const light = recolorPixel("rainviewer", 0x00, 0xa3, 0xe0, 255); // 20 dBZ rain
    const heavy = recolorPixel("rainviewer", 0xc1, 0x00, 0x00, 255); // 50 dBZ rain
    assert.ok(alpha(light) > 0 && alpha(heavy) > 0);
    assert.ok(!isSnowColor(light) && !isSnowColor(heavy));
    const [r, g] = rgb(heavy);
    assert.ok(r > 120 && g < 60, "50 dBZ rain should be red");
  });

  it("paints snow source colors with the lilac → purple snow palette", () => {
    const light = recolorPixel("rainviewer", 0x9f, 0xdf, 0xff, 255); // 15 dBZ snow
    const heavy = recolorPixel("rainviewer", 0x2f, 0x6f, 0xff, 255); // 40 dBZ snow
    assert.ok(isSnowColor(light), "light snow should be lilac");
    assert.ok(isSnowColor(heavy), "heavy snow should be purple");
    assert.ok(rgb(heavy)[1] < rgb(light)[1], "heavier snow should be darker");
  });

  it("keeps rain 15 dBZ and snow 15 dBZ apart even though both are pale blue in the source", () => {
    assert.ok(!isSnowColor(recolorPixel("rainviewer", 0x88, 0xdd, 0xee, 255)));
    assert.ok(isSnowColor(recolorPixel("rainviewer", 0x9f, 0xdf, 0xff, 255)));
  });

  it("drops the faint tan sub-10 dBZ haze and transparent pixels", () => {
    assert.equal(recolorPixel("rainviewer", 0x82, 0x7b, 0x69, 0x49), 0);
    assert.equal(recolorPixel("rainviewer", 0, 0, 0, 0), 0);
  });

  it("drops colors that are not in the source table (e.g. map labels)", () => {
    assert.equal(recolorPixel("rainviewer", 0x10, 0x10, 0x10, 255), 0);
  });
});

describe("recolorPixel (NOAA NWS scale)", () => {
  it("maps the NWS green/yellow/red steps onto the same rain palette as RainViewer", () => {
    const nws40 = recolorPixel("noaa", 0xe5, 0xbc, 0x00, 255);
    const rv40 = recolorPixel("rainviewer", 0xff, 0xaa, 0x00, 255);
    assert.deepEqual(rgb(nws40), rgb(rv40), "40 dBZ must look the same on both radars");
    assert.deepEqual(rgb(nws40), hex(RAIN_STOPS.find(([dbz]) => dbz === 40)![1]));
  });

  it("never paints NOAA pixels as snow (MRMS reflectivity has no type)", () => {
    for (const [r, g, b] of [[0x01, 0x9f, 0xf4], [0x03, 0x00, 0xf4], [0x98, 0x54, 0xc6]]) {
      const out = recolorPixel("noaa", r, g, b, 255);
      if (out) assert.ok(!SNOW_STOPS.some(([, c]) => hex(c).join() === rgb(out).join()));
    }
  });
});
