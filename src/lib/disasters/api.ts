import { createServerFn } from "@tanstack/react-start";
import type { AnalystResult, AtlasPayload, OwmSample, PointForecast } from "./types";

function cleanKey(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export const loadAtlas = createServerFn({ method: "POST" })
  .validator((input: { nasaKey?: string }) => ({
    nasaKey: cleanKey(input?.nasaKey, 80),
  }))
  .handler(async ({ data }): Promise<AtlasPayload> => {
    const { loadAtlasData } = await import("./feeds.server");
    return loadAtlasData(data.nasaKey);
  });

export const pointForecast = createServerFn({ method: "POST" })
  .validator((input: { lat: number; lon: number; owmKey?: string }) => {
    const lat = Number(input?.lat);
    const lon = Number(input?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new Error("Bad coordinates");
    }
    return { lat, lon, owmKey: cleanKey(input?.owmKey, 80) };
  })
  .handler(async ({ data }): Promise<PointForecast> => {
    const { loadPointForecast } = await import("./feeds.server");
    return loadPointForecast(data.lat, data.lon, data.owmKey);
  });

export const blendOpenWeather = createServerFn({ method: "POST" })
  .validator((input: { owmKey?: string; points?: { id: string; lat: number; lon: number }[] }) => {
    const points = Array.isArray(input?.points) ? input.points.slice(0, 24) : [];
    return {
      owmKey: cleanKey(input?.owmKey, 80),
      points: points
        .map((point) => ({
          id: cleanKey(point?.id, 12),
          lat: Number(point?.lat),
          lon: Number(point?.lon),
        }))
        .filter((point) => point.id && Number.isFinite(point.lat) && Number.isFinite(point.lon)),
    };
  })
  .handler(async ({ data }): Promise<{ rows: OwmSample[]; error: string | null }> => {
    const { loadOwmBlend } = await import("./feeds.server");
    return loadOwmBlend(data.owmKey, data.points);
  });

export const askAnalyst = createServerFn({ method: "POST" })
  .validator((input: {
      minimaxKey?: string;
      context?: string;
      mode?: string;
      messages?: { role?: string; content?: string }[];
    }): {
      minimaxKey: string;
      context: string;
      mode: "chat" | "scan" | "refine";
      messages: { role: "user" | "assistant"; content: string }[];
    } => {
      let mode: "chat" | "scan" | "refine" = "chat";
      if (input?.mode === "scan" || input?.mode === "refine") mode = input.mode;
      const messages = Array.isArray(input?.messages) ? input.messages.slice(-8) : [];
      return {
        minimaxKey: cleanKey(input?.minimaxKey, 200),
        context: typeof input?.context === "string" ? input.context.slice(0, 7500) : "",
        mode,
        messages: messages
          .filter((message) => message?.role === "user" || message?.role === "assistant")
          .map((message) => ({
            role: message.role as "user" | "assistant",
            content: String(message.content ?? "").slice(0, 1800),
          }))
          .filter((message) => message.content),
      };
    })
  .handler(async ({ data }): Promise<AnalystResult> => {
    const { runAnalyst } = await import("./ai.server");
    return runAnalyst(data);
  });
