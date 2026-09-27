import { useState } from 'react';
import { BigButton, Dialog, ScanGroup, SettingsPanel } from '@access-suite/access-ui';

interface Tool {
  name: string;
  status: 'available' | 'next' | 'planned';
  blurb: string;
  href?: string;
}

const TOOLS: Tool[] = [
  {
    name: 'Phrase Board',
    status: 'available',
    blurb: 'Build a message by tapping, scanning or dwelling on words, then hear it spoken. Optional AI turns a few words into full sentences.',
    href: './phrase-board/',
  },
  {
    name: 'Listen & Reply',
    status: 'available',
    blurb: 'Captions what someone says to you and turns their words into buttons, so you can reply in a few selections.',
    href: './listen-reply/',
  },
  {
    name: 'Vocabulary Builder',
    status: 'available',
    blurb: 'Turn your own messages and transcripts into a personal word list, processed entirely on your device. Your words then appear in the other tools.',
    href: './vocabulary-builder/',
  },
  {
    name: 'Dwell Panels',
    status: 'planned',
    blurb: 'Design your own big-button panels for dwell, switch or touch: care needs, pain scales, quick replies.',
  },
  {
    name: 'Mac Toolkit',
    status: 'planned',
    blurb: 'Keyboard Maestro macros and Accessibility Keyboard panels for hands-free control of macOS apps.',
  },
];

const STATUS_LABEL: Record<Tool['status'], string> = {
  available: 'Available',
  next: 'Coming next',
  planned: 'Planned',
};

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="hub">
      <header className="hub-header">
        <div>
          <h1>Access Suite</h1>
          <p className="tagline">Free communication and access tools for people with speech and motor impairments.</p>
        </div>
        <ScanGroup label="Settings">
          <BigButton onClick={() => setSettingsOpen(true)}>⚙ Settings</BigButton>
        </ScanGroup>
      </header>

      <main>
        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading">Tools</h2>
          <ul className="tool-list">
            {TOOLS.map((t) => (
              <li key={t.name} className={`tool tool--${t.status}`}>
                <div className="tool__head">
                  <h3>{t.name}</h3>
                  <span className="pill">{STATUS_LABEL[t.status]}</span>
                </div>
                <p>{t.blurb}</p>
                {t.href && (
                  <ScanGroup label={`Open ${t.name}`}>
                    <a className="big-btn big-btn--primary open-link" href={t.href} data-scan-item="">
                      Open {t.name}
                    </a>
                  </ScanGroup>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="principles-heading" className="principles">
          <h2 id="principles-heading">How it works</h2>
          <ul>
            <li>
              <strong>Free.</strong> No account, no subscription, no ads. It’s a static website.
            </li>
            <li>
              <strong>Private.</strong> Your words, saved phrases and settings stay in this browser. Nothing is sent
              to us — there is no “us” server.
            </li>
            <li>
              <strong>Every way of selecting.</strong> Touch, mouse, keyboard, one or two switches, and dwell for head
              pointers and eye gaze. Choose in Settings.
            </li>
            <li>
              <strong>AI is optional.</strong> If you want sentence suggestions, add your own Anthropic or OpenAI key
              in Settings. It’s stored only on this device and sent only to that provider.
            </li>
          </ul>
        </section>
      </main>

      <footer className="hub-footer">
        <p>
          Open source (MIT). Built from earlier work on communication aids for people with ALS and locked-in
          syndrome.
        </p>
      </footer>

      <Dialog open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <p className="help">These settings apply to every tool in the suite on this device.</p>
        <SettingsPanel />
      </Dialog>
    </div>
  );
}
