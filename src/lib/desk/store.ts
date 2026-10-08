import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DeskDraft, DeskWindow } from "./types";

type DeskState = {
  windows: DeskWindow[];
  widget: { x: number; y: number };
  z: number;
  open: (draft: DeskDraft) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  togglePin: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  moveWidget: (x: number, y: number) => void;
};

function spot(index: number): { x: number; y: number } {
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  return {
    x: Math.max(12, width - 860 - index * 18),
    y: 88 + (index % 5) * 22,
  };
}

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => ({
      windows: [],
      widget: { x: 280, y: 150 },
      z: 1,
      open: (draft) => {
        const existing = get().windows.find((item) => item.kind === draft.kind && item.title === draft.title);
        if (existing) {
          set((state) => ({
            z: state.z + 1,
            windows: state.windows.map((item) =>
              item.id === existing.id ? { ...item, ...draft, id: item.id, minimized: false, z: state.z + 1 } : item,
            ),
          }));
          return;
        }
        const at = spot(get().windows.length);
        const z = get().z + 1;
        const next: DeskWindow = {
          ...draft,
          id: crypto.randomUUID(),
          x: at.x,
          y: at.y,
          z,
          minimized: false,
          pinned: false,
        };
        set((state) => ({ z, windows: [...state.windows, next] }));
      },
      close: (id) => set((state) => ({ windows: state.windows.filter((item) => item.id !== id) })),
      minimize: (id) =>
        set((state) => ({
          windows: state.windows.map((item) => (item.id === id ? { ...item, minimized: true } : item)),
        })),
      restore: (id) =>
        set((state) => ({
          z: state.z + 1,
          windows: state.windows.map((item) => (item.id === id ? { ...item, minimized: false, z: state.z + 1 } : item)),
        })),
      togglePin: (id) =>
        set((state) => ({
          windows: state.windows.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)),
        })),
      focus: (id) =>
        set((state) => ({
          z: state.z + 1,
          windows: state.windows.map((item) => (item.id === id ? { ...item, z: state.z + 1 } : item)),
        })),
      move: (id, x, y) =>
        set((state) => ({
          windows: state.windows.map((item) => (item.id === id ? { ...item, x, y } : item)),
        })),
      moveWidget: (x, y) => set({ widget: { x, y } }),
    }),
    {
      name: "gwn-desk",
      skipHydration: true,
      partialize: (state) => ({
        widget: state.widget,
        windows: state.windows.filter((item) => item.pinned),
      }),
    },
  ),
);
