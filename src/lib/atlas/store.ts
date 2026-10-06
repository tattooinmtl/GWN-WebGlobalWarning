import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Metric } from "@/lib/disasters/types";

export type LayerPrefs = {
  choropleth: boolean;
  radar: boolean;
  owmTiles: boolean;
  quakes: boolean;
  floods: boolean;
  fires: boolean;
  storms: boolean;
  volcanoes: boolean;
  other: boolean;
  radius: boolean;
  faultsActive: boolean;
  faultsDormant: boolean;
};

export type Prefs = {
  radiusKm: number;
  minQuakeAlert: number;
  alertsOn: boolean;
  owmKey: string;
  nasaKey: string;
  minimaxKey: string;
  hintDismissed: boolean;
  layers: LayerPrefs;
};

export type UserLocation = {
  lat: number;
  lon: number;
  label: string;
  at: number;
  approximate: boolean;
};

type FlyRequest = { lon: number; lat: number; zoom: number; nonce: number };

type AtlasState = {
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
  patchPrefs: (partial: Partial<Prefs>) => void;
  metric: Metric;
  setMetric: (metric: Metric) => void;
  selectedIso: string | null;
  setSelectedIso: (id: string | null) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  location: UserLocation | null;
  setLocation: (location: UserLocation | null) => void;
  locStatus: "idle" | "locating" | "denied" | "ready";
  setLocStatus: (status: AtlasState["locStatus"]) => void;
  sheet: "places" | "agent" | "layers" | null;
  setSheet: (sheet: AtlasState["sheet"]) => void;
  prefsOpen: boolean;
  setPrefsOpen: (open: boolean) => void;
  flyRequest: FlyRequest | null;
  requestFly: (lon: number, lat: number, zoom?: number) => void;
  zoomNonce: number;
  zoomBy: number;
  nudgeZoom: (delta: number) => void;
  pendingPrompt: string | null;
  queuePrompt: (prompt: string) => void;
  clearPrompt: () => void;
  owmRain: Record<string, number>;
  setOwmRain: (rain: Record<string, number>) => void;
  aiLayer: { metric: Metric; values: Record<string, number>; note: string } | null;
  setAiLayer: (layer: AtlasState["aiLayer"]) => void;
};

const defaultLayers: LayerPrefs = {
  choropleth: true,
  radar: true,
  owmTiles: false,
  quakes: true,
  floods: true,
  fires: true,
  storms: true,
  volcanoes: true,
  other: true,
  radius: true,
  faultsActive: true,
  faultsDormant: true,
};

export function mergeLayers(layers?: Partial<LayerPrefs> | null): LayerPrefs {
  return { ...defaultLayers, ...layers };
}

export const defaultPrefs: Prefs = {
  radiusKm: 200,
  minQuakeAlert: 4,
  alertsOn: true,
  owmKey: "",
  nasaKey: "",
  minimaxKey: "",
  hintDismissed: false,
  layers: defaultLayers,
};

export const useAtlas = create<AtlasState>()(
  persist(
    (set) => ({
      prefs: defaultPrefs,
      setPrefs: (prefs) => set({ prefs }),
      patchPrefs: (partial) => set((state) => ({ prefs: { ...state.prefs, ...partial } })),
      metric: "flood",
      setMetric: (metric) => set({ metric, aiLayer: null }),
      selectedIso: null,
      setSelectedIso: (selectedIso) => set({ selectedIso }),
      selectedEventId: null,
      setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
      location: null,
      setLocation: (location) => set({ location }),
      locStatus: "idle",
      setLocStatus: (locStatus) => set({ locStatus }),
      sheet: null,
      setSheet: (sheet) => set({ sheet }),
      prefsOpen: false,
      setPrefsOpen: (prefsOpen) => set({ prefsOpen }),
      flyRequest: null,
      requestFly: (lon, lat, zoom = 4.4) => set({ flyRequest: { lon, lat, zoom, nonce: Date.now() } }),
      zoomNonce: 0,
      zoomBy: 0,
      nudgeZoom: (delta) => set((state) => ({ zoomBy: delta, zoomNonce: state.zoomNonce + 1 })),
      pendingPrompt: null,
      queuePrompt: (pendingPrompt) => set({ pendingPrompt, sheet: "agent" }),
      clearPrompt: () => set({ pendingPrompt: null }),
      owmRain: {},
      setOwmRain: (owmRain) => set({ owmRain }),
      aiLayer: null,
      setAiLayer: (aiLayer) => set({ aiLayer }),
    }),
    {
      name: "meridian-prefs",
      skipHydration: true,
      partialize: (state) => ({
        prefs: state.prefs,
        metric: state.metric,
        location: state.location,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AtlasState>;
        const savedPrefs = saved.prefs;
        return {
          ...current,
          ...saved,
          prefs: {
            ...defaultPrefs,
            ...savedPrefs,
            layers: mergeLayers(savedPrefs?.layers),
          },
        };
      },
    },
  ),
);
