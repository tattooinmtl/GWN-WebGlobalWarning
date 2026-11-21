import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { solarAltitudeDeg } from "./locate.ts";

describe("solarAltitudeDeg", () => {
  it("is 90° when the observer is at the subsolar point", () => {
    assert.ok(Math.abs(solarAltitudeDeg(-20, -24, -20, -24) - 90) < 1e-9);
  });

  it("is -90° at the antipode", () => {
    assert.ok(Math.abs(solarAltitudeDeg(20, 156, -20, -24) + 90) < 1e-6);
  });

  it("treats morning Montreal as day and Vancouver as night for a late-November 13:21 UTC sun", () => {
    const sunLat = -19.9865;
    const sunLon = -23.7977;
    assert.ok(solarAltitudeDeg(45.5, -73.57, sunLat, sunLon) > 0);
    assert.ok(solarAltitudeDeg(43.65, -79.38, sunLat, sunLon) > 0);
    assert.ok(solarAltitudeDeg(49.28, -123.12, sunLat, sunLon) < 0);
  });
});
