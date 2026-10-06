import type { AnalystResult } from "./types";

const grokBudget = { n: 0, reset: 0 };

function takeGrokBudget(): boolean {
  const now = Date.now();
  if (now > grokBudget.reset) {
    grokBudget.n = 0;
    grokBudget.reset = now + 60 * 60 * 1000;
  }
  if (grokBudget.n >= 36) return false;
  grokBudget.n += 1;
  return true;
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

function textOf(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "");
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

async function chat(
  url: string,
  key: string,
  model: string,
  messages: Msg[],
  extra: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      ...extra,
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const text = textOf(body.choices?.[0]?.message?.content);
  if (!text) throw new Error("empty response");
  return text;
}

async function minimax(key: string, model: string, messages: Msg[]): Promise<string> {
  const url = "https://api.minimax.io/v1/chat/completions";
  try {
    return await chat(url, key, model, messages, {
      max_completion_tokens: 900,
      reasoning_effort: "low",
    });
  } catch {
    return chat(url, key, model, messages, { max_tokens: 900 });
  }
}

function systemPrompt(mode: "chat" | "scan" | "refine"): string {
  const shared =
    "You are GWN, the analyst for a live natural-hazard map. Use ONLY the context JSON-like notes. If a fact is not in the context, say the live feeds do not show it. Never invent magnitudes, coordinates, death tolls, or records. Name the source (USGS, NASA EONET, GDACS, NWS, Open-Meteo, OpenWeather, ReliefWeb, Google News) when you cite a fact.";
  if (mode === "refine") {
    return `${shared} Reweight the ACTIVE metric only. Return JSON and nothing else: {"note":"one sentence","scores":{"COUNTRY_ID":0}}. Scores are integers 0-100. Include only country ids from the context. 0 means quiet, 100 means the strongest pressure supported by the supplied rain millimeters, OpenWeather samples, magnitudes, and alert counts.`;
  }
  if (mode === "scan") {
    return `${shared} Scan the headlines against the structured events. Write a briefing under 180 words: the most serious hazards, floods worth watching, and anything inside the user radius if a location is present. Attribute headlines. Do not add map pins.`;
  }
  return `${shared} Answer the user's question in under 160 words. Be specific and calm. If they ask about their radius and no location is present, say so.`;
}

export async function runAnalyst(input: {
  minimaxKey: string;
  context: string;
  mode: "chat" | "scan" | "refine";
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<AnalystResult> {
  const history = input.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1800),
    }));
  const messages: Msg[] = [
    { role: "system", content: systemPrompt(input.mode) },
    { role: "user", content: `Live context:\n${input.context.slice(0, 7500)}` },
    ...history,
  ];
  if (input.mode !== "chat" && history.length === 0) {
    messages.push({
      role: "user",
      content: input.mode === "refine" ? "Weight the active metric layer from the context." : "Scan the wires now.",
    });
  }

  if (input.minimaxKey) {
    try {
      const text = await minimax(input.minimaxKey, "MiniMax-M3.1-Flash-Preview", messages);
      return { ok: true, text, model: "MiniMax-M3.1-Flash-Preview" };
    } catch {
      try {
        const text = await minimax(input.minimaxKey, "MiniMax-M3", messages);
        return { ok: true, text, model: "MiniMax-M3" };
      } catch (err) {
        const reason = err instanceof Error ? err.message : "failed";
        if (!process.env.XAI_API_KEY) {
          return { ok: false, error: `MiniMax failed (${reason}). Check the key in Preferences.` };
        }
      }
    }
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: input.minimaxKey
        ? "MiniMax failed and the built-in analyst is unavailable."
        : "Add a MiniMax key in Preferences. The built-in analyst is not available in this environment.",
    };
  }
  if (!takeGrokBudget()) {
    return { ok: false, error: "The built-in analyst is paused until the hourly limit resets." };
  }
  try {
    const text = await chat("https://api.x.ai/v1/chat/completions", apiKey, "grok-4.5", messages, {
      max_tokens: 700,
    });
    return { ok: true, text, model: "Grok" };
  } catch (err) {
    return { ok: false, error: `Analyst error (${err instanceof Error ? err.message : "failed"}).` };
  }
}
