import { useEffect, useRef, useState } from "react";
import { askAnalyst } from "@/lib/disasters/api";
import { parseLayerScores } from "@/lib/disasters/context";
import type { CountryStat, Headline, Metric } from "@/lib/disasters/types";
import { useAtlas } from "@/lib/atlas/store";

type Turn = { role: "user" | "assistant"; content: string; model?: string };

type Props = {
  context: string;
  headlines: Headline[];
  spaceWeather: { title: string; time: string }[];
  countries: CountryStat[];
  metric: Metric;
};

export function CopilotDock({ context, headlines, spaceWeather, countries, metric }: Props) {
  const minimaxKey = useAtlas((s) => s.prefs.minimaxKey);
  const pending = useAtlas((s) => s.pendingPrompt);
  const clearPrompt = useAtlas((s) => s.clearPrompt);
  const setAiLayer = useAtlas((s) => s.setAiLayer);
  const [tab, setTab] = useState<"ask" | "wires">("ask");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentPrompt = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns, busy]);

  useEffect(() => {
    if (!pending || sentPrompt.current === pending) return;
    sentPrompt.current = pending;
    clearPrompt();
    void send(pending, "chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function send(text: string, mode: "chat" | "scan" | "refine") {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setBusy(true);
    setTab("ask");
    const history = mode === "chat" ? [...turns, { role: "user" as const, content }] : [];
    if (mode === "chat") setTurns(history);
    setDraft("");
    try {
      const result = await askAnalyst({
        data: {
          minimaxKey,
          context: contextRef.current,
          mode,
          messages: history.map((turn) => ({ role: turn.role, content: turn.content })),
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "refine") {
        const parsed = parseLayerScores(result.text, countries);
        if (!parsed) {
          setError("The analyst did not return a usable layer. The live scores are unchanged.");
          setTurns((current) => [
            ...current,
            { role: "assistant", content: result.text, model: result.model },
          ]);
          return;
        }
        setAiLayer({ metric, values: parsed.scores, note: parsed.note });
        setTurns((current) => [
          ...current,
          {
            role: "assistant",
            model: result.model,
            content: parsed.note || `Reweighted ${Object.keys(parsed.scores).length} countries from the live numbers.`,
          },
        ]);
        return;
      }
      const lead = mode === "scan" ? "Wire scan" : content;
      setTurns((current) => {
        const base = mode === "chat" ? current : [...current, { role: "user" as const, content: lead }];
        return [...base, { role: "assistant", content: result.text, model: result.model }];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The analyst could not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dock h-full" aria-label="GWN agent">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
        <div>
          <p className="font-display text-2xl leading-none tracking-wide">Agent</p>
          <p className="text-xs text-muted">{minimaxKey ? "MiniMax M3.1, M3 fallback" : "Built-in analyst, or add MiniMax"}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" className="chip h-9" data-on={tab === "ask" ? "true" : "false"} onClick={() => setTab("ask")}>
            Ask
          </button>
          <button type="button" className="chip h-9" data-on={tab === "wires" ? "true" : "false"} onClick={() => setTab("wires")}>
            Wires
          </button>
        </div>
      </header>
      {tab === "wires" ? (
        <div className="dock-scroll flex flex-col gap-2 px-3 py-3">
          {spaceWeather.map((item) => (
            <p key={item.title} className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm">
              <span className="text-xs text-amber">NASA DONKI</span>
              <span className="mt-1 block">{item.title}</span>
            </p>
          ))}
          {headlines.length === 0 ? <p className="text-sm text-muted">No headlines in this pull.</p> : null}
          {headlines.map((item) => (
            <a
              key={item.title}
              href={item.url || undefined}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-line px-3 py-2 text-sm hover:border-muted"
            >
              <span className="text-xs text-cyan">{item.source}</span>
              <span className="mt-1 block">{item.title}</span>
            </a>
          ))}
        </div>
      ) : (
        <>
          <div ref={scroller} className="dock-scroll flex flex-col gap-2 px-3 py-3">
            {turns.length === 0 ? (
              <div className="text-sm text-muted">
                <p>Ask about the map. Answers stay inside the feeds that just loaded.</p>
                <div className="mt-3 flex flex-col gap-2">
                  {[
                    "Which countries have the heaviest rain right now?",
                    "What is the strongest earthquake on the map?",
                    "Anything inside my alert radius?",
                  ].map((prompt) => (
                    <button key={prompt} type="button" className="chip h-auto justify-start px-3 py-2 text-left" onClick={() => void send(prompt, "chat")}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {turns.map((turn, index) => (
              <article
                key={`${turn.role}-${index}`}
                className={
                  turn.role === "user"
                    ? "self-end max-w-[90%] rounded-2xl bg-amber px-3 py-2 text-sm text-bg"
                    : "max-w-[95%] rounded-2xl border border-line bg-panel-2 px-3 py-2 text-sm"
                }
              >
                {turn.model ? <p className="mb-1 text-xs text-muted">{turn.model}</p> : null}
                <p className="whitespace-pre-wrap">{turn.content}</p>
              </article>
            ))}
            {busy ? <p className="text-sm text-muted">Reading the feeds…</p> : null}
            {error ? <p className="text-sm text-crimson">{error}</p> : null}
          </div>
          <form
            className="flex flex-col gap-2 border-t border-line p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft, "chat");
            }}
          >
            <div className="flex gap-2">
              <button type="button" className="chip" disabled={busy} onClick={() => void send("Scan the latest headlines against the structured events.", "scan")}>
                Scan wires
              </button>
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => void send("Weight the active metric from the live numbers and return JSON scores.", "refine")}
              >
                Refine layer
              </button>
            </div>
            <div className="flex gap-2">
              <textarea
                className="field min-h-11 resize-none"
                rows={2}
                value={draft}
                placeholder="Ask about a country, a quake, your radius…"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft, "chat");
                  }
                }}
              />
              <button type="submit" className="chip" data-on="true" disabled={busy || !draft.trim()}>
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
