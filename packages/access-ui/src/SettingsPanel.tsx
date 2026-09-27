import { useId, type ReactNode } from 'react';
import { PROVIDERS, type ProviderId } from '@access-suite/ai';
import { BigButton, ScanGroup } from './components';
import { useSettings, type AiProviderId, type InputMode } from './settings';
import { speak, speechSupported, useVoices } from './speech';

const INPUT_MODES: { id: InputMode; label: string; help: string }[] = [
  { id: 'direct', label: 'Touch, mouse & keyboard', help: 'Tap or click. Tab moves between buttons; Enter or Space selects.' },
  { id: 'scan-auto', label: 'One switch (auto-scan)', help: 'Rows light up in turn. Press Space or Enter (your switch) to choose.' },
  { id: 'scan-step', label: 'Two switches (step-scan)', help: 'Space or → moves the highlight. Enter chooses.' },
  { id: 'dwell', label: 'Dwell (head pointer, eye gaze)', help: 'Rest the pointer on a button to choose it.' },
];

function Field({ label, children, help }: { label: string; children: (id: string) => ReactNode; help?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {help && <p className="help">{help}</p>}
    </div>
  );
}

/** Shared settings UI used by the hub and every tool. */
export function SettingsPanel({ showAi = true }: { showAi?: boolean }) {
  const { settings, update, reset } = useSettings();
  const voices = useVoices();
  const provider = settings.aiProvider === 'none' ? null : PROVIDERS[settings.aiProvider as ProviderId];

  return (
    <div className="settings">
      <fieldset>
        <legend>How do you select?</legend>
        {INPUT_MODES.map((m) => (
          <label key={m.id} className="radio-card">
            <input
              type="radio"
              name="input-mode"
              value={m.id}
              checked={settings.inputMode === m.id}
              onChange={() => update({ inputMode: m.id })}
            />
            <span>
              <strong>{m.label}</strong>
              <span className="help">{m.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {settings.inputMode === 'scan-auto' && (
        <Field label={`Scan speed: ${(settings.scanIntervalMs / 1000).toFixed(1)} s per step`}>
          {(id) => (
            <input id={id} type="range" min={500} max={4000} step={100} value={settings.scanIntervalMs}
              onChange={(e) => update({ scanIntervalMs: Number(e.target.value) })} />
          )}
        </Field>
      )}
      {(settings.inputMode === 'scan-auto' || settings.inputMode === 'scan-step') && (
        <label className="check">
          <input type="checkbox" checked={settings.scanSpeak} onChange={(e) => update({ scanSpeak: e.target.checked })} />
          Speak each highlighted item (auditory scanning)
        </label>
      )}
      {settings.inputMode === 'dwell' && (
        <Field label={`Dwell time: ${(settings.dwellMs / 1000).toFixed(1)} s`}>
          {(id) => (
            <input id={id} type="range" min={400} max={3000} step={100} value={settings.dwellMs}
              onChange={(e) => update({ dwellMs: Number(e.target.value) })} />
          )}
        </Field>
      )}

      <fieldset>
        <legend>Display</legend>
        <Field label={`Button size: ${settings.targetSize}px`}>
          {(id) => (
            <input id={id} type="range" min={48} max={140} step={4} value={settings.targetSize}
              onChange={(e) => update({ targetSize: Number(e.target.value) })} />
          )}
        </Field>
        <label className="check">
          <input type="checkbox" checked={settings.highContrast} onChange={(e) => update({ highContrast: e.target.checked })} />
          High contrast
        </label>
      </fieldset>

      <fieldset>
        <legend>Voice</legend>
        {!speechSupported() && <p className="warn">This browser can’t speak text aloud. Messages will still show on screen.</p>}
        <Field label="Voice">
          {(id) => (
            <select id={id} value={settings.voiceURI ?? ''} onChange={(e) => update({ voiceURI: e.target.value || null })}>
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={`Speed: ${settings.rate.toFixed(1)}×`}>
          {(id) => (
            <input id={id} type="range" min={0.5} max={2} step={0.1} value={settings.rate}
              onChange={(e) => update({ rate: Number(e.target.value) })} />
          )}
        </Field>
        <Field label={`Pitch: ${settings.pitch.toFixed(1)}`}>
          {(id) => (
            <input id={id} type="range" min={0.5} max={2} step={0.1} value={settings.pitch}
              onChange={(e) => update({ pitch: Number(e.target.value) })} />
          )}
        </Field>
        <ScanGroup label="Test voice">
          <BigButton onClick={() => speak('Hello, this is my voice.', settings)}>Test voice</BigButton>
        </ScanGroup>
      </fieldset>

      {showAi && (
        <fieldset>
          <legend>AI suggestions (optional)</legend>
          <p className="help">
            Turns a few words into full sentences to choose from. Everything else works without it. Your key is stored
            only in this browser and sent only to the provider you pick — never to us.
          </p>
          <Field label="Provider">
            {(id) => (
              <select
                id={id}
                value={settings.aiProvider}
                onChange={(e) => {
                  const p = e.target.value as AiProviderId;
                  update({ aiProvider: p, aiModel: p === 'none' ? '' : PROVIDERS[p].defaultModel });
                }}
              >
                <option value="none">Off</option>
                {Object.values(PROVIDERS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {provider?.needsKey && (
            <>
              <Field
                label="API key"
                help={provider.keyUrl ? `Create one at ${provider.keyUrl.replace('https://', '')}. Usage is billed to your account.` : undefined}
              >
                {(id) => (
                  <input id={id} type="password" autoComplete="off" spellCheck={false} placeholder={provider.keyHint}
                    value={settings.aiKey} onChange={(e) => update({ aiKey: e.target.value.trim() })} />
                )}
              </Field>
              <Field label="Model">
                {(id) => (
                  <select id={id} value={settings.aiModel || provider.defaultModel} onChange={(e) => update({ aiModel: e.target.value })}>
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {settings.aiKey && (
                <ScanGroup label="Forget key">
                  <BigButton variant="danger" onClick={() => update({ aiKey: '' })}>
                    Forget my key
                  </BigButton>
                </ScanGroup>
              )}
            </>
          )}
        </fieldset>
      )}

      <ScanGroup label="Reset settings">
        <BigButton variant="quiet" onClick={reset}>
          Reset all settings
        </BigButton>
      </ScanGroup>
    </div>
  );
}
