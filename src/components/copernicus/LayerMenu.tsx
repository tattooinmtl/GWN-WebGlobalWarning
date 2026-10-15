import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { cmemsLegend } from "@/lib/copernicus/api";
import { CMAPS, GROUPS, LAYERS, type CmemsLayer, type GroupId, type LayerSettings } from "@/lib/copernicus/layers";

type Props = {
  settings: Record<string, LayerSettings>;
  onChange: (id: string, patch: Partial<LayerSettings>) => void;
};

export function LayerMenu({ settings, onChange }: Props) {
  const [open, setOpen] = useState<Record<GroupId, boolean>>({
    temperature: true,
    currents: false,
    salinity: false,
    waves: false,
    ice: false,
    life: false,
  });
  return (
    <div className="flex flex-col gap-2">
      {GROUPS.map((group) => {
        const layers = LAYERS.filter((layer) => layer.group === group.id);
        const active = layers.filter((layer) => settings[layer.id]?.on).length;
        return (
          <section key={group.id} className="cm-tile">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              aria-expanded={open[group.id]}
              onClick={() => setOpen((state) => ({ ...state, [group.id]: !state[group.id] }))}
            >
              <span className="flex items-center gap-2 font-display text-lg leading-none tracking-wide">
                <span aria-hidden>{group.icon}</span>
                {group.label}
              </span>
              <span className="flex items-center gap-2">
                {active ? <span className="cm-count">{active}</span> : null}
                <ChevronDown className={open[group.id] ? "size-4 rotate-180 transition" : "size-4 transition"} />
              </span>
            </button>
            {open[group.id] ? (
              <div className="flex flex-col gap-1 border-t border-line px-2 pb-2 pt-1">
                {layers.map((layer) => (
                  <LayerRow key={layer.id} layer={layer} config={settings[layer.id]} onChange={(patch) => onChange(layer.id, patch)} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function LayerRow({ layer, config, onChange }: { layer: CmemsLayer; config: LayerSettings; onChange: (patch: Partial<LayerSettings>) => void }) {
  const [tuning, setTuning] = useState(false);
  const display = (value: number) => (layer.unit === "%" ? value * 100 : value);
  const store = (value: number) => (layer.unit === "%" ? value / 100 : value);
  return (
    <div className="rounded-md px-1 py-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={config.on}
          aria-label={`Show ${layer.label}`}
          className="cm-switch"
          data-on={config.on ? "true" : "false"}
          onClick={() => onChange({ on: !config.on })}
        >
          <span />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{layer.label}</p>
          <p className="truncate text-xs text-muted">{layer.hint}</p>
        </div>
        {config.on ? (
          <button type="button" className="cm-mini" data-on={tuning ? "true" : "false"} onClick={() => setTuning((t) => !t)}>
            Filters
          </button>
        ) : null}
      </div>
      {config.on ? <Legend layer={layer} config={config} /> : null}
      {config.on && tuning ? (
        <div className="mt-2 grid gap-2 rounded-md bg-bg/70 p-2 text-xs">
          <label className="grid gap-1">
            <span className="flex justify-between text-muted">
              Opacity <span>{Math.round(config.opacity * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={config.opacity}
              onChange={(event) => onChange({ opacity: Number(event.target.value) })}
              className="cm-range"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-muted">From ({layer.unit})</span>
              <input
                type="number"
                className="field py-1.5"
                value={display(config.range[0])}
                step="any"
                onChange={(event) => {
                  const value = store(Number(event.target.value));
                  if (Number.isFinite(value) && value < config.range[1]) onChange({ range: [value, config.range[1]] });
                }}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted">To ({layer.unit})</span>
              <input
                type="number"
                className="field py-1.5"
                value={display(config.range[1])}
                step="any"
                onChange={(event) => {
                  const value = store(Number(event.target.value));
                  if (Number.isFinite(value) && value > config.range[0]) onChange({ range: [config.range[0], value] });
                }}
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={config.onlyInRange} onChange={(event) => onChange({ onlyInRange: event.target.checked })} />
            Only show values inside this range
          </label>
          {layer.vector ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.arrows} onChange={(event) => onChange({ arrows: event.target.checked })} />
              Show direction arrows
            </label>
          ) : null}
          <label className="grid gap-1">
            <span className="text-muted">Colors</span>
            <select className="field py-1.5" value={config.cmap} onChange={(event) => onChange({ cmap: event.target.value })}>
              {CMAPS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="cm-mini justify-self-start" onClick={() => onChange({ cmap: layer.cmap, range: layer.range, onlyInRange: false, opacity: 0.85 })}>
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Legend({ layer, config }: { layer: CmemsLayer; config: LayerSettings }) {
  const query = useQuery({
    queryKey: ["cmems-legend", layer.id, config.cmap, config.range, config.onlyInRange, config.arrows],
    queryFn: () => cmemsLegend({ data: { layerId: layer.id, settings: config } }),
    staleTime: 3_600_000,
  });
  const fmt = (value: number) => {
    const shown = layer.unit === "%" ? value * 100 : value;
    return Math.abs(shown) >= 100 ? shown.toFixed(0) : shown.toFixed(layer.digits > 1 ? 2 : 1);
  };
  const colors = query.data?.gradient ?? [];
  return (
    <div className="mt-1.5 pl-11">
      <div
        className="h-2 w-full rounded-sm"
        style={{ background: colors.length ? `linear-gradient(90deg, ${colors.join(", ")})` : "var(--color-line)" }}
        aria-hidden
      />
      <div className="mt-0.5 flex justify-between text-[11px] text-muted">
        <span>{fmt(config.range[0])}</span>
        <span>{query.isError ? "legend unavailable" : layer.unit}</span>
        <span>{fmt(config.range[1])}</span>
      </div>
    </div>
  );
}
