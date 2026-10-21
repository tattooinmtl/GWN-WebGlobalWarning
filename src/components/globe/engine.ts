/**
 * Three.js globe for /globe. Client-only (imported dynamically from GlobeApp).
 *
 * Frame: Earth-fixed. +Y = north pole, lon 0 on +X, lon 90°E on -Z. The globe never rotates; the Sun and Moon
 * move around it from real ephemerides (astronomy-engine), which is what makes the terminator correct.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { latLonToXYZ, skyAt, xyzToLatLon, type SkyState } from "@/lib/globe/astro";
import {
  BLACK_MARBLE,
  BLUE_MARBLE,
  IR_LAYERS,
  eoxTilesAround,
  gibsTilesAround,
  loadImage,
  stitchEoxWorld,
  stitchGibsWorld,
  stitchMercatorWorld,
  type TileBox,
} from "@/lib/globe/tiles";
import { LEVEL_STYLE, TYPE_GLYPH, type GlobeMarker, type WarnLevel } from "@/lib/globe/events";

export type OverlayId = "clouds" | "precip" | "quakeHeat" | "sst";
export type LayerState = "off" | "loading" | "ok" | "error";

export type EngineCallbacks = {
  onPick: (marker: GlobeMarker | null) => void;
  onLayerState: (id: string, state: LayerState, note?: string) => void;
  onSky: (sky: SkyState) => void;
};

const MOON_DIST = 14; // Earth radii (real ≈ 60); direction is exact, distance compressed so it stays in view.
const MOON_RADIUS = 0.273 * 1.6; // true size ratio 0.273, slightly enlarged for legibility.

const WORLD_BOUNDS = new THREE.Vector4(-180, 180, -90, 90);

const EARTH_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const LATLON_GLSL = /* glsl */ `
  vec2 latLon(vec3 p) {
    vec3 n = normalize(p);
    return vec2(degrees(asin(clamp(n.y, -1.0, 1.0))), degrees(atan(-n.z, n.x)));
  }
  vec2 boxUv(vec2 ll, vec4 b) {
    float lon = ll.y;
    if (lon < b.x - 0.0001) lon += 360.0;
    return vec2((lon - b.x) / (b.y - b.x), (ll.x - b.z) / (b.w - b.z));
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D dayTex;
  uniform sampler2D nightTex;
  uniform vec4 bounds;
  uniform vec3 sunDir;
  uniform float nightOn;
  uniform float hasDay;
  varying vec3 vPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  ${LATLON_GLSL}
  void main() {
    vec2 ll = latLon(vPos);
    vec2 uv = boxUv(ll, bounds);
    vec3 day = hasDay > 0.5 ? texture2D(dayTex, uv).rgb : vec3(0.05, 0.12, 0.22);
    vec2 guv = vec2((ll.y + 180.0) / 360.0, (ll.x + 90.0) / 180.0);
    vec3 night = texture2D(nightTex, guv).rgb;

    vec3 n = normalize(vWorldNormal);
    float cosSun = dot(n, sunDir);
    // Day weight: full sun above ~+6°, black below ~-12° (nautical twilight).
    float dayW = smoothstep(-0.21, 0.10, cosSun);
    float direct = max(cosSun, 0.0);

    vec3 lit = day * (0.2 + 1.15 * pow(direct, 0.6));
    // Ocean glint: dark, blue-dominant pixels get a sun reflection.
    float ocean = step(day.r * 1.15, day.b) * (1.0 - smoothstep(0.18, 0.4, dot(day, vec3(0.333))));
    vec3 h = normalize(sunDir + vViewDir);
    lit += ocean * pow(max(dot(n, h), 0.0), 380.0) * vec3(1.0, 0.92, 0.75) * 0.12 * step(0.0, cosSun);

    float lightsLum = dot(night, vec3(0.299, 0.587, 0.114));
    vec3 lights = vec3(1.0, 0.78, 0.45) * pow(lightsLum, 1.4) * 1.7 * nightOn;
    vec3 dark = day * 0.035 + lights;

    vec3 col = mix(dark, lit, dayW);
    // Warm terminator band.
    float band = exp(-pow(cosSun / 0.07, 2.0));
    col += vec3(1.0, 0.42, 0.12) * band * 0.18;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const OVERLAY_FRAG = /* glsl */ `
  uniform sampler2D tex;
  uniform vec4 bounds;
  uniform vec3 sunDir;
  uniform float opacity;
  uniform float mode; // 0 rgba, 1 IR -> clouds
  uniform float shade;
  varying vec3 vPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  ${LATLON_GLSL}
  void main() {
    vec2 uv = boxUv(latLon(vPos), bounds);
    vec4 t = texture2D(tex, uv);
    vec3 rgb = t.rgb;
    float a = t.a;
    if (mode > 0.5) {
      float mx = max(rgb.r, max(rgb.g, rgb.b));
      float mn = min(rgb.r, min(rgb.g, rgb.b));
      float sat = mx - mn;
      float lum = dot(rgb, vec3(0.333));
      // GIBS clean-IR palette: grey = warm surface/low cloud, bright grey = cold cloud, colours = very cold tops.
      float cloud = max(smoothstep(0.38, 0.9, lum) * (1.0 - smoothstep(0.12, 0.25, sat)), 0.9 * smoothstep(0.12, 0.35, sat));
      a *= cloud;
      rgb = mix(vec3(0.92), vec3(1.0), smoothstep(0.15, 0.4, sat));
    }
    float cosSun = dot(normalize(vWorldNormal), sunDir);
    float light = mix(1.0, mix(0.07, 1.0, smoothstep(-0.12, 0.2, cosSun)), shade);
    gl_FragColor = vec4(rgb * light, a * opacity);
    #include <colorspace_fragment>
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormalW;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormalW, vView)), 2.6);
    float sun = smoothstep(-0.35, 0.4, dot(vNormalW, sunDir));
    vec3 col = mix(vec3(0.05, 0.08, 0.2), vec3(0.32, 0.62, 1.0), sun);
    gl_FragColor = vec4(col, rim * mix(0.25, 0.95, sun));
  }
`;

function canvasTexture(canvas: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  const tex = canvas instanceof HTMLCanvasElement ? new THREE.CanvasTexture(canvas) : new THREE.Texture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // No mipmaps: the lon seam (atan wrap) would otherwise pick the smallest mip and draw a line.
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function placeholderTexture(color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 2, 2);
  return canvasTexture(c);
}

function iconCanvas(type: string, level: WarnLevel): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const color = LEVEL_STYLE[level].color;
  const glow = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  glow.addColorStop(0, `${color}cc`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  // Warning-sign shape for orange/red, round badge otherwise.
  ctx.beginPath();
  if (level === "orange" || level === "red") {
    ctx.moveTo(64, 20);
    ctx.lineTo(106, 96);
    ctx.lineTo(22, 96);
    ctx.closePath();
  } else {
    ctx.arc(64, 64, 30, 0, Math.PI * 2);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#070b12";
  ctx.stroke();
  ctx.fillStyle = "#070b12";
  ctx.font = "bold 34px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const glyph = level === "orange" || level === "red" ? "!" : (TYPE_GLYPH[type] ?? "!");
  ctx.fillText(glyph, 64, level === "orange" || level === "red" ? 74 : 66);
  return c;
}

type MarkerObj = {
  marker: GlobeMarker;
  group: THREE.Group;
  sprite: THREE.Sprite;
  ring: THREE.Mesh;
  ring2: THREE.Mesh;
  phase: number;
};

type Patch = { key: string; mesh: THREE.Mesh; tex: THREE.Texture };

export class GlobeEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private earthMat: THREE.ShaderMaterial;
  private earth: THREE.Mesh;
  private atmoMat: THREE.ShaderMaterial;
  private sunDir = new THREE.Vector3(1, 0, 0);
  private sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  private sunSprite: THREE.Sprite;
  private moon: THREE.Mesh;
  private overlays = new Map<OverlayId, THREE.Mesh>();
  private overlayLoads = new Map<OverlayId, Promise<void>>();
  private faults: { active: THREE.LineSegments; dormant: THREE.LineSegments } | null = null;
  private faultsLoading: Promise<void> | null = null;
  private markerRoot = new THREE.Group();
  private markers: MarkerObj[] = [];
  private iconCache = new Map<string, THREE.Texture>();
  private patchRoot = new THREE.Group();
  private patches = new Map<string, Patch>();
  private patchMats: THREE.ShaderMaterial[] = [];
  private baseKind: "bluemarble" | "s2" = "bluemarble";
  private baseTextures: { bluemarble: THREE.Texture | null; s2: THREE.Texture | null } = { bluemarble: null, s2: null };
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private frame = 0;
  private t0 = performance.now();
  private lastSky = 0;
  private zoomTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObs: ResizeObserver;
  private disposed = false;
  private downAt: { x: number; y: number } | null = null;
  private selected: string | null = null;
  timeOverride: Date | null = null;

  constructor(
    private container: HTMLElement,
    private cb: EngineCallbacks,
  ) {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x02040a);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.001, 400);
    const start = latLonToXYZ(30, -40, 3.4);
    this.camera.position.set(...start);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.03;
    this.controls.maxDistance = 30;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;
    this.controls.addEventListener("change", () => this.onCameraChange());

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos: number[] = [];
    for (let i = 0; i < 4000; i += 1) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(180 + Math.random() * 60);
      starPos.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.8 }),
      ),
    );

    // Earth
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: {
        dayTex: { value: placeholderTexture("#0b1d33") },
        nightTex: { value: placeholderTexture("#000000") },
        bounds: { value: WORLD_BOUNDS.clone() },
        sunDir: { value: this.sunDir },
        nightOn: { value: 1 },
        hasDay: { value: 0 },
      },
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), this.earthMat);
    this.scene.add(this.earth);
    this.scene.add(this.patchRoot);

    // Atmosphere
    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { sunDir: { value: this.sunDir } },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 48), this.atmoMat));

    // Sun glow sprite + light for the Moon
    const sunCanvas = document.createElement("canvas");
    sunCanvas.width = sunCanvas.height = 256;
    const sctx = sunCanvas.getContext("2d")!;
    const g = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,250,235,1)");
    g.addColorStop(0.12, "rgba(255,236,190,0.95)");
    g.addColorStop(0.35, "rgba(255,190,90,0.25)");
    g.addColorStop(1, "rgba(255,160,60,0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 256, 256);
    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: canvasTexture(sunCanvas), transparent: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.sunSprite.scale.setScalar(16);
    this.sunSprite.renderOrder = -10; // drawn first so the globe always hides it
    this.sunSprite.material.depthTest = true;
    this.scene.add(this.sunSprite);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x223344, 0.12));

    // Moon texture: three.js example asset (NASA imagery), served with CORS from threejs.org; plain grey if it fails.
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 64, 32);
    moonGeo.rotateY(-Math.PI / 2); // put texture lon 0 (near side) on local +Z, which lookAt points at Earth
    this.moon = new THREE.Mesh(moonGeo, new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 1, metalness: 0 }));
    this.scene.add(this.moon);
    void loadImage("https://threejs.org/examples/textures/planets/moon_1024.jpg").then((img) => {
      if (!img || this.disposed) return;
      const mat = this.moon.material as THREE.MeshStandardMaterial;
      mat.map = canvasTexture(img);
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });

    this.markerRoot.renderOrder = 10;
    this.scene.add(this.markerRoot);

    this.updateSky(true);
    void this.loadBase();

    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    this.renderer.domElement.addEventListener("pointerup", this.onUp);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.loop();
  }

  // ---------- base imagery ----------

  private async loadBase() {
    this.cb.onLayerState("base", "loading");
    let tex: THREE.Texture | null = null;
    const day = stitchGibsWorld([BLUE_MARBLE], 2, (canvas) => {
      if (!tex) {
        tex = canvasTexture(canvas);
        this.baseTextures.bluemarble = tex;
        if (this.baseKind === "bluemarble") this.setDayTexture(tex);
      } else tex.needsUpdate = true;
    });
    const night = stitchGibsWorld([BLACK_MARBLE], 2).then(({ canvas, loaded }) => {
      if (this.disposed || !loaded) return;
      this.earthMat.uniforms.nightTex.value = canvasTexture(canvas);
      for (const m of this.patchMats) m.uniforms.nightTex.value = this.earthMat.uniforms.nightTex.value;
    });
    const [res] = await Promise.all([day, night]);
    if (this.disposed) return;
    this.cb.onLayerState("base", res.loaded ? "ok" : "error", res.loaded ? undefined : "NASA GIBS unreachable");
  }

  private setDayTexture(tex: THREE.Texture) {
    this.earthMat.uniforms.dayTex.value = tex;
    this.earthMat.uniforms.hasDay.value = 1;
  }

  /** Swap the daytime surface between NASA Blue Marble and Copernicus Sentinel-2 cloudless (EOX). */
  async setBase(kind: "bluemarble" | "s2") {
    this.baseKind = kind;
    this.clearPatches();
    if (kind === "bluemarble") {
      if (this.baseTextures.bluemarble) this.setDayTexture(this.baseTextures.bluemarble);
      this.cb.onLayerState("s2", "off");
      this.scheduleZoomTiles();
      return;
    }
    if (this.baseTextures.s2) {
      this.setDayTexture(this.baseTextures.s2);
      this.cb.onLayerState("s2", "ok");
      this.scheduleZoomTiles();
      return;
    }
    this.cb.onLayerState("s2", "loading");
    let tex: THREE.Texture | null = null;
    const res = await stitchEoxWorld(3, (canvas) => {
      if (!tex) {
        tex = canvasTexture(canvas);
        this.baseTextures.s2 = tex;
        if (this.baseKind === "s2") this.setDayTexture(tex);
      } else tex.needsUpdate = true;
    });
    if (this.disposed) return;
    this.cb.onLayerState("s2", res.loaded ? "ok" : "error", res.loaded ? undefined : "EOX tiles unreachable");
    this.scheduleZoomTiles();
  }

  setNightLights(on: boolean) {
    this.earthMat.uniforms.nightOn.value = on ? 1 : 0;
    for (const m of this.patchMats) m.uniforms.nightOn.value = on ? 1 : 0;
  }

  setMoonVisible(on: boolean) {
    this.moon.visible = on;
  }

  // ---------- zoom tiles ----------

  private onCameraChange() {
    this.scheduleZoomTiles();
  }

  private scheduleZoomTiles() {
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    this.zoomTimer = setTimeout(() => this.updateZoomTiles(), 350);
  }

  private zoomLevel(): number {
    const alt = this.camera.position.length() - 1;
    const h = this.renderer.domElement.clientHeight || 800;
    const degPerPx = ((alt * (this.camera.fov * Math.PI)) / 180 / h) * (180 / Math.PI);
    return degPerPx;
  }

  private updateZoomTiles() {
    if (this.disposed) return;
    const degPerPx = this.zoomLevel();
    const { lat, lon } = xyzToLatLon(this.camera.position.x, this.camera.position.y, this.camera.position.z);
    let boxes: TileBox[] = [];
    if (this.baseKind === "bluemarble") {
      // Base canvas is level 2 (~0.14°/px). Go finer only when the screen asks for it.
      let level = Math.ceil(Math.log2(288 / (512 * degPerPx)));
      level = Math.min(BLUE_MARBLE.maxLevel, level);
      if (level >= 3) boxes = gibsTilesAround(BLUE_MARBLE, level, lat, lon, 4);
    } else {
      let level = Math.ceil(Math.log2(180 / (256 * degPerPx)));
      level = Math.min(13, level);
      if (level >= 4) boxes = eoxTilesAround(level, lat, lon, 5);
    }
    const want = new Set(boxes.map((b) => b.key));
    for (const [key, patch] of this.patches) {
      if (!want.has(key)) this.removePatch(key, patch);
    }
    for (const box of boxes) {
      if (this.patches.has(box.key)) continue;
      this.patches.set(box.key, { key: box.key, mesh: null as unknown as THREE.Mesh, tex: null as unknown as THREE.Texture });
      void loadImage(box.url).then((img) => {
        const slot = this.patches.get(box.key);
        if (!img || this.disposed || !slot) {
          if (slot && !slot.mesh) this.patches.delete(box.key);
          return;
        }
        const tex = canvasTexture(img);
        const mat = this.earthMat.clone();
        mat.uniforms = THREE.UniformsUtils.clone(this.earthMat.uniforms);
        mat.uniforms.sunDir.value = this.sunDir;
        mat.uniforms.nightTex.value = this.earthMat.uniforms.nightTex.value;
        mat.uniforms.dayTex.value = tex;
        mat.uniforms.hasDay.value = 1;
        mat.uniforms.bounds.value = new THREE.Vector4(box.lon0, box.lon1, box.texLat0, box.lat1);
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -2;
        mat.polygonOffsetUnits = -2;
        this.patchMats.push(mat);
        const toRad = Math.PI / 180;
        const geo = new THREE.SphereGeometry(
          1.0004,
          24,
          24,
          Math.PI + box.lon0 * toRad,
          (box.lon1 - box.lon0) * toRad,
          (90 - box.lat1) * toRad,
          (box.lat1 - box.lat0) * toRad,
        );
        const mesh = new THREE.Mesh(geo, mat);
        this.patchRoot.add(mesh);
        slot.mesh = mesh;
        slot.tex = tex;
      });
    }
  }

  private removePatch(key: string, patch: Patch) {
    if (patch.mesh) {
      this.patchRoot.remove(patch.mesh);
      patch.mesh.geometry.dispose();
      const mat = patch.mesh.material as THREE.ShaderMaterial;
      this.patchMats = this.patchMats.filter((m) => m !== mat);
      mat.dispose();
      patch.tex.dispose();
    }
    this.patches.delete(key);
  }

  private clearPatches() {
    for (const [key, patch] of [...this.patches]) this.removePatch(key, patch);
  }

  // ---------- overlays ----------

  private makeOverlay(id: OverlayId, radius: number, tex: THREE.Texture, mode: number, shade: number, opacity: number) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: OVERLAY_FRAG,
      uniforms: {
        tex: { value: tex },
        bounds: { value: WORLD_BOUNDS.clone() },
        sunDir: { value: this.sunDir },
        opacity: { value: opacity },
        mode: { value: mode },
        shade: { value: shade },
      },
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 192, 96), mat);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.overlays.set(id, mesh);
    return mesh;
  }

  async setOverlay(id: OverlayId, on: boolean, extra?: { precipTemplate?: string; sstTemplate?: string; quakes?: QuakePoint[] }) {
    const existing = this.overlays.get(id);
    if (existing) {
      existing.visible = on;
      this.cb.onLayerState(id, on ? "ok" : "off");
      return;
    }
    if (!on) {
      this.cb.onLayerState(id, "off");
      return;
    }
    if (this.overlayLoads.has(id)) return this.overlayLoads.get(id);
    const job = (async () => {
      this.cb.onLayerState(id, "loading");
      try {
        if (id === "clouds") {
          const res = await stitchGibsWorld(IR_LAYERS, 1);
          if (!res.loaded) throw new Error("GIBS IR tiles unreachable");
          this.makeOverlay("clouds", 1.006, canvasTexture(res.canvas), 1, 1, 0.78);
          this.cb.onLayerState(id, "ok", "Americas + Asia-Pacific (no Meteosat in GIBS)");
        } else if (id === "precip") {
          if (!extra?.precipTemplate) throw new Error("No RainViewer frame");
          const res = await stitchMercatorWorld(extra.precipTemplate, 2, 512, 2048);
          if (!res.loaded) throw new Error("RainViewer tiles unreachable");
          this.makeOverlay("precip", 1.004, canvasTexture(res.canvas), 0, 0, 0.9);
          this.cb.onLayerState(id, "ok");
        } else if (id === "sst") {
          if (!extra?.sstTemplate) throw new Error("No Copernicus Marine layer");
          let res = await stitchMercatorWorld(extra.sstTemplate, 2, 256, 2048);
          if (!res.loaded) {
            // Browser blocked the direct request: go through the existing same-origin relay.
            res = await stitchMercatorWorld(extra.sstTemplate, 2, 256, 2048, (u) => `/api/cmems?u=${encodeURIComponent(u)}`);
          }
          if (!res.loaded) throw new Error("Copernicus Marine tiles unreachable");
          this.makeOverlay("sst", 1.0025, canvasTexture(res.canvas), 0, 1, 0.6);
          this.cb.onLayerState(id, "ok");
        } else if (id === "quakeHeat") {
          const pts = extra?.quakes ?? [];
          if (!pts.length) throw new Error("No USGS quakes loaded");
          this.makeOverlay("quakeHeat", 1.003, canvasTexture(heatCanvas(pts)), 0, 0, 0.85);
          this.cb.onLayerState(id, "ok", `${pts.length} quakes M2.5+ · 30 days`);
        }
      } catch (err) {
        this.cb.onLayerState(id, "error", err instanceof Error ? err.message : String(err));
      } finally {
        this.overlayLoads.delete(id);
      }
    })();
    this.overlayLoads.set(id, job);
    return job;
  }

  // ---------- faults ----------

  async setFaults(active: boolean, dormant: boolean) {
    if ((active || dormant) && !this.faults && !this.faultsLoading) {
      this.faultsLoading = (async () => {
        this.cb.onLayerState("faults", "loading");
        try {
          const res = await fetch("/geo/faults.geojson");
          const json = (await res.json()) as {
            features: { properties: { c: string }; geometry: { type: string; coordinates: number[][] } }[];
          };
          const act: number[] = [];
          const dor: number[] = [];
          for (const f of json.features) {
            if (f.geometry?.type !== "LineString") continue;
            const out = f.properties?.c === "d" ? dor : act;
            const c = f.geometry.coordinates;
            for (let i = 0; i < c.length - 1; i += 1) {
              out.push(...latLonToXYZ(c[i][1], c[i][0], 1.0015), ...latLonToXYZ(c[i + 1][1], c[i + 1][0], 1.0015));
            }
          }
          const mk = (arr: number[], color: number, opacity: number) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
            const line = new THREE.LineSegments(
              geo,
              new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
            );
            line.renderOrder = 3;
            this.scene.add(line);
            return line;
          };
          this.faults = { active: mk(act, 0xff4d2e, 0.95), dormant: mk(dor, 0x9fb4c8, 0.6) };
          this.cb.onLayerState("faults", "ok", `${json.features.length.toLocaleString()} traces`);
        } catch (err) {
          this.cb.onLayerState("faults", "error", err instanceof Error ? err.message : String(err));
        }
      })();
    }
    await this.faultsLoading;
    if (this.faults) {
      this.faults.active.visible = active;
      this.faults.dormant.visible = dormant;
    }
  }

  // ---------- markers ----------

  private icon(type: string, level: WarnLevel): THREE.Texture {
    const key = `${type}/${level}`;
    let tex = this.iconCache.get(key);
    if (!tex) {
      tex = canvasTexture(iconCanvas(type, level));
      this.iconCache.set(key, tex);
    }
    return tex;
  }

  setMarkers(list: GlobeMarker[]) {
    for (const m of this.markers) {
      this.markerRoot.remove(m.group);
      m.ring.geometry.dispose();
      (m.ring.material as THREE.Material).dispose();
      (m.ring2.material as THREE.Material).dispose();
      (m.sprite.material as THREE.Material).dispose();
    }
    this.markers = [];
    const ringGeo = new THREE.RingGeometry(0.72, 1, 48);
    // Lowest levels first so red markers draw on top.
    const sorted = [...list].sort((a, b) => LEVEL_STYLE[a.level].rank - LEVEL_STYLE[b.level].rank);
    for (const marker of sorted) {
      const style = LEVEL_STYLE[marker.level];
      const p = new THREE.Vector3(...latLonToXYZ(marker.lat, marker.lon, 1));
      const group = new THREE.Group();
      group.position.copy(p);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.icon(marker.type, marker.level), transparent: true, depthWrite: false }),
      );
      sprite.position.copy(p.clone().multiplyScalar(0.012));
      sprite.userData.markerId = marker.id;
      sprite.renderOrder = 12 + style.rank;
      const ringMat = new THREE.MeshBasicMaterial({
        color: style.color,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
      for (const r of [ring, ring2]) {
        r.position.copy(p.clone().multiplyScalar(0.0015));
        r.lookAt(p.clone().multiplyScalar(3));
        r.renderOrder = 11;
        group.add(r);
      }
      group.add(sprite);
      this.markerRoot.add(group);
      this.markers.push({ marker, group, sprite, ring, ring2, phase: Math.random() });
    }
    this.applySelection();
  }

  select(id: string | null, fly = false) {
    this.selected = id;
    this.applySelection();
    const m = this.markers.find((x) => x.marker.id === id);
    if (m && fly) this.flyTo(m.marker.lat, m.marker.lon);
  }

  private applySelection() {
    for (const m of this.markers) m.group.userData.selected = m.marker.id === this.selected;
  }

  flyTo(lat: number, lon: number, dist?: number) {
    const from = this.camera.position.clone();
    const d = dist ?? Math.min(from.length(), 2.2);
    const to = new THREE.Vector3(...latLonToXYZ(lat, lon, d));
    const start = performance.now();
    const dur = 1100;
    const step = () => {
      if (this.disposed) return;
      const t = Math.min(1, (performance.now() - start) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const dir = from.clone().normalize().lerp(to.clone().normalize(), e).normalize();
      const len = from.length() + (d - from.length()) * e;
      this.camera.position.copy(dir.multiplyScalar(len));
      this.camera.lookAt(0, 0, 0);
      this.controls.update();
      if (t < 1) requestAnimationFrame(step);
      else this.scheduleZoomTiles();
    };
    requestAnimationFrame(step);
  }

  zoomBy(factor: number) {
    const len = THREE.MathUtils.clamp(this.camera.position.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.setLength(len);
    this.controls.update();
    this.scheduleZoomTiles();
  }

  // ---------- picking ----------

  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const earthHit = this.raycaster.intersectObject(this.earth, false)[0];
    const hits = this.raycaster.intersectObjects(
      this.markers.map((m) => m.sprite),
      false,
    );
    const hit = hits.find((h) => !earthHit || h.distance < earthHit.distance + 0.005);
    const id = hit?.object.userData.markerId as string | undefined;
    const marker = this.markers.find((m) => m.marker.id === id)?.marker ?? null;
    this.select(marker?.id ?? null);
    this.cb.onPick(marker);
  };

  // ---------- sky ----------

  private updateSky(force = false) {
    const now = performance.now();
    if (!force && now - this.lastSky < 1000) return;
    this.lastSky = now;
    const sky = skyAt(this.timeOverride ?? new Date());
    this.sunDir.set(...latLonToXYZ(sky.sun.lat, sky.sun.lon, 1));
    this.sunLight.position.copy(this.sunDir).multiplyScalar(100);
    this.sunSprite.position.copy(this.sunDir).multiplyScalar(120);
    const moonPos = new THREE.Vector3(...latLonToXYZ(sky.moon.lat, sky.moon.lon, MOON_DIST));
    this.moon.position.copy(moonPos);
    this.moon.lookAt(0, 0, 0);
    // Sun light on the Moon comes from the true Sun direction; the Moon sits at its true direction, so the lit
    // fraction seen from Earth matches the real phase.
    this.cb.onSky(sky);
  }

  sunLatLon() {
    return xyzToLatLon(this.sunDir.x, this.sunDir.y, this.sunDir.z);
  }

  // ---------- loop ----------

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const t = (performance.now() - this.t0) / 1000;
    this.controls.update();
    this.updateSky();
    const dist = this.camera.position.length();
    const k = THREE.MathUtils.clamp((dist - 1) / 2.2, 0.035, 1.6);
    this.controls.rotateSpeed = THREE.MathUtils.clamp((dist - 1) / 3, 0.04, 0.6);
    for (const m of this.markers) {
      const style = LEVEL_STYLE[m.marker.level];
      const sel = m.group.userData.selected === true;
      const size = style.size * k * (sel ? 1.6 : 1);
      m.sprite.scale.setScalar(size * 2.4);
      m.sprite.position.copy(m.group.position.clone().normalize().multiplyScalar(size * 0.5));
      for (const [i, r] of [m.ring, m.ring2].entries()) {
        const ph = (t * style.pulseHz + m.phase + i * 0.5) % 1;
        r.scale.setScalar(size * (0.6 + ph * (2.2 + style.rank * 0.8)));
        (r.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * (0.55 + style.rank * 0.12);
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    this.resizeObs.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onUp);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export type QuakePoint = { lat: number; lon: number; mag: number };

/** Equirectangular heatmap: additive magnitude-weighted blobs, then a yellow→red→white palette. */
function heatCanvas(points: QuakePoint[]): HTMLCanvasElement {
  const W = 2048;
  const H = 1024;
  const acc = document.createElement("canvas");
  acc.width = W;
  acc.height = H;
  const ctx = acc.getContext("2d")!;
  ctx.globalCompositeOperation = "lighter";
  for (const p of points) {
    const x = ((p.lon + 180) / 360) * W;
    const y = ((90 - p.lat) / 180) * H;
    const w = Math.min(1, Math.max(0.06, (p.mag - 2) / 5));
    const r = 6 + w * 16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.1 + w * 0.35})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const stops: [number, [number, number, number]][] = [
    [0, [40, 0, 90]],
    [0.25, [180, 30, 120]],
    [0.5, [255, 90, 40]],
    [0.75, [255, 200, 40]],
    [1, [255, 255, 220]],
  ];
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i + 3] / 255; // 'lighter' accumulates in alpha (rgb stays white)
    if (v <= 0.01) {
      d[i + 3] = 0;
      continue;
    }
    let j = 0;
    while (j < stops.length - 2 && v > stops[j + 1][0]) j += 1;
    const [a, ca] = stops[j];
    const [b, cb] = stops[j + 1];
    const f = Math.min(1, Math.max(0, (v - a) / (b - a)));
    d[i] = ca[0] + (cb[0] - ca[0]) * f;
    d[i + 1] = ca[1] + (cb[1] - ca[1]) * f;
    d[i + 2] = ca[2] + (cb[2] - ca[2]) * f;
    d[i + 3] = Math.min(235, 30 + v * 380);
  }
  ctx.globalCompositeOperation = "copy";
  ctx.putImageData(img, 0, 0);
  return acc;
}
