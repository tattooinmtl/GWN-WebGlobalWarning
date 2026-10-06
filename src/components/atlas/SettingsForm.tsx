import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Prefs } from "@/lib/atlas/store";
import { useAtlas } from "@/lib/atlas/store";

export function SettingsForm({ onClose }: { onClose: () => void }) {
  const prefs = useAtlas((s) => s.prefs);
  const setPrefs = useAtlas((s) => s.setPrefs);
  const patchPrefs = useAtlas((s) => s.patchPrefs);
  const [keys, setKeys] = useState({ owmKey: prefs.owmKey, nasaKey: prefs.nasaKey, minimaxKey: prefs.minimaxKey });

  useEffect(() => {
    setKeys({ owmKey: prefs.owmKey, nasaKey: prefs.nasaKey, minimaxKey: prefs.minimaxKey });
  }, [prefs.owmKey, prefs.nasaKey, prefs.minimaxKey]);

  function save(next: Partial<Pick<Prefs, "owmKey" | "nasaKey" | "minimaxKey">>) {
    setPrefs({ ...useAtlas.getState().prefs, ...next });
  }

  return (
    <div className="flex max-h-[80dvh] flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-2xl leading-none tracking-wide">Preferences</p>
          <p className="text-xs text-muted">Keys stay in this browser. They are only sent to that provider.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close preferences">
          <X className="size-4" />
        </button>
      </header>
      <div className="dock-scroll flex flex-col gap-4 px-4 py-4 text-sm">
        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between">
            Alert radius
            <span className="tabular-nums text-amber">{prefs.radiusKm} km</span>
          </span>
          <input
            type="range"
            min={25}
            max={1000}
            step={25}
            value={prefs.radiusKm}
            className="accent-amber"
            onChange={(event) => patchPrefs({ radiusKm: Number(event.target.value) })}
          />
          <span className="text-xs text-muted">Warn when a flood, storm, fire, volcano, or quake at or above your magnitude sits inside this distance.</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between">
            Quake alert magnitude
            <span className="tabular-nums text-amber">M{prefs.minQuakeAlert.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min={2.5}
            max={7}
            step={0.5}
            value={prefs.minQuakeAlert}
            className="accent-amber"
            onChange={(event) => patchPrefs({ minQuakeAlert: Number(event.target.value) })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
          <span>Radius warnings</span>
          <input
            type="checkbox"
            checked={prefs.alertsOn}
            onChange={(event) => patchPrefs({ alertsOn: event.target.checked })}
          />
        </label>
        <KeyField
          label="OpenWeatherMap key"
          hint="Blends real 1-hour rain into the flood colors (up to 24 wet countries) and unlocks optional precip tiles."
          value={keys.owmKey}
          onChange={(owmKey) => setKeys((current) => ({ ...current, owmKey }))}
          onSave={() => save({ owmKey: keys.owmKey.trim() })}
        />
        <KeyField
          label="NASA API key"
          hint="Optional. Earth events already come from EONET. A key adds DONKI space-weather notices."
          value={keys.nasaKey}
          onChange={(nasaKey) => setKeys((current) => ({ ...current, nasaKey }))}
          onSave={() => save({ nasaKey: keys.nasaKey.trim() })}
        />
        <KeyField
          label="MiniMax key"
          hint="Headline scan and the copilot use MiniMax-M3.1-Flash-Preview, then MiniMax-M3. Without a key, GWN uses the built-in analyst."
          value={keys.minimaxKey}
          onChange={(minimaxKey) => setKeys((current) => ({ ...current, minimaxKey }))}
          onSave={() => save({ minimaxKey: keys.minimaxKey.trim() })}
        />
      </div>
    </div>
  );
}

function KeyField({
  label,
  hint,
  value,
  onChange,
  onSave,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span>{label}</span>
      <span className="text-xs text-muted">{hint}</span>
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          className="field"
          value={value}
          placeholder="Paste key"
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="chip" data-on="true" onClick={onSave}>
          Save
        </button>
      </div>
    </label>
  );
}
