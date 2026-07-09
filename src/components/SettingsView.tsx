import { motion } from 'motion/react';
import { useStore, type AmbienceId } from '../state/store';
import { Button, Label, Panel } from './ui';

const AMBIENCES: { id: AmbienceId; name: string; blurb: string }[] = [
  { id: 'drift', name: 'Cosmic Drift', blurb: 'A slow, evolving pad' },
  { id: 'cockpit', name: 'Cockpit', blurb: 'Sparse mechanical hums' },
  { id: 'silence', name: 'Deep Silence', blurb: 'Near-silent, distant tones' },
];

function Toggle({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm text-ink-100">{label}</div>
        {note && <div className="text-xs text-ink-500">{note}</div>}
      </div>
      {/*
        Knob position is driven entirely by `checked`: an inline-flex track (so
        the knob is a deterministic flex child, not an unanchored absolute box)
        with an explicit inline `transform` (the `transform` property, which
        `transition-transform` actually animates — Tailwind v4's translate-x-*
        writes the separate `translate` property instead). Off → left + muted
        track; on → right + amber track and border, so the two states differ by
        position, colour, and border, never colour alone.
      */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ${
          checked ? 'border-accent-400 bg-accent-600' : 'border-space-700 bg-space-800'
        }`}
      >
        <span
          aria-hidden="true"
          className="h-[18px] w-[18px] rounded-full bg-ink-100 shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: checked ? 'translateX(23px)' : 'translateX(3px)' }}
        />
      </button>
    </div>
  );
}

export function SettingsView({ onBack }: { onBack: () => void }) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-full flex-col items-center overflow-y-auto px-4 py-10"
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="quiet" onClick={onBack}>← Back</Button>
          <Label>Settings</Label>
        </div>
        <Panel className="divide-y divide-space-700/60">
          <div className="pb-4">
            <label htmlFor="volume" className="text-sm text-ink-100">
              Volume
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
                className="flex-1 accent-[#e8b45a]"
              />
              <span className="w-12 text-right font-mono text-xs text-ink-300">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
          </div>

          <Toggle label="Mute" checked={settings.muted} onChange={(v) => updateSettings({ muted: v })} />

          <div className="py-3">
            <Label className="mb-2">Ambience</Label>
            <div role="radiogroup" aria-label="Ambience" className="flex flex-col gap-1">
              {AMBIENCES.map((a) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={settings.ambience === a.id}
                  onClick={() => updateSettings({ ambience: a.id })}
                  className={`flex items-baseline justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    settings.ambience === a.id
                      ? 'border-accent-600 bg-accent-400/5 text-ink-100'
                      : 'border-space-700 text-ink-300 hover:text-ink-100'
                  }`}
                >
                  <span className="text-sm">{a.name}</span>
                  <span className="text-xs text-ink-500">{a.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <Toggle
            label="Reduce motion"
            note="Also follows your system preference"
            checked={settings.reducedMotion}
            onChange={(v) => updateSettings({ reducedMotion: v })}
          />
          <Toggle
            label="Skip launch ritual"
            note="Lift off without the briefing pause"
            checked={settings.skipRitual}
            onChange={(v) => updateSettings({ skipRitual: v })}
          />
          <Toggle
            label="Halfway ping"
            note="A very soft tone at the midpoint"
            checked={settings.halfwayPing}
            onChange={(v) => updateSettings({ halfwayPing: v })}
          />
        </Panel>
      </div>
    </motion.div>
  );
}
