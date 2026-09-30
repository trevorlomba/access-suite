import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessInput, SettingsProvider, type Settings } from '@access-suite/access-ui';
import { App } from './App';

const spoken: string[] = [];

beforeEach(() => {
  spoken.length = 0;
  class Utterance {
    constructor(public text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', {
    speak: (u: Utterance) => spoken.push(u.text),
    cancel: () => {},
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});

function renderApp(initial?: Partial<Settings>) {
  return render(
    <SettingsProvider initial={initial}>
      <AccessInput>
        <App />
      </AccessInput>
    </SettingsProvider>,
  );
}

async function partnerSays(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: /type what they said/i }));
  const dialog = screen.getByRole('dialog', { name: 'What did they say?' });
  await user.type(within(dialog).getByRole('textbox'), text);
  await user.click(within(dialog).getByRole('button', { name: 'Add' }));
}

describe('Listen & Reply', () => {
  it('explains the typed fallback when speech recognition is unavailable', () => {
    renderApp();
    expect(screen.queryByRole('button', { name: /listen/i })).not.toBeInTheDocument();
    expect(screen.getByText(/can’t turn speech into text/i)).toBeInTheDocument();
  });

  it('shows what was said, offers yes/no quick replies, and speaks one', async () => {
    const user = userEvent.setup();
    renderApp();
    await partnerSays(user, 'Do you want the blinds open?');
    expect(screen.getByText('“Do you want the blinds open?”')).toBeInTheDocument();
    expect(screen.getByText('Yes/no question')).toBeInTheDocument();
    await user.click(within(screen.getByRole('group', { name: 'Quick replies' })).getByRole('button', { name: 'No' }));
    expect(spoken).toEqual(['No']);
  });

  it('builds a reply from their words and my words', async () => {
    const user = userEvent.setup();
    renderApp();
    await partnerSays(user, 'What would you like for dinner');
    await user.click(within(screen.getByRole('group', { name: 'Pronouns' })).getByRole('button', { name: 'I' }));
    await user.click(screen.getByRole('button', { name: 'Show core words' }));
    await user.click(screen.getByRole('button', { name: 'want' }));
    const theirs = screen.getByRole('group', { name: 'Their words' });
    await user.click(within(theirs).getByRole('button', { name: 'dinner' }));
    await user.click(screen.getByRole('button', { name: /speak/i }));
    expect(spoken).toEqual(['I want dinner']);
  });

  it('keeps an in-progress reply when they say something new, and can go back to earlier', async () => {
    const user = userEvent.setup();
    renderApp();
    await partnerSays(user, 'Are you cold');
    await user.click(within(screen.getByRole('group', { name: 'Their words' })).getByRole('button', { name: 'cold' }));
    await partnerSays(user, 'Should I get a blanket');
    expect(within(screen.getByRole('group', { name: /message words/i })).getAllByRole('button').map((b) => b.textContent)).toEqual(['cold']);
    await user.click(screen.getByRole('button', { name: 'Earlier (1)' }));
    await user.click(screen.getByRole('button', { name: '“Are you cold”' }));
    expect(screen.getByText('“Are you cold”')).toBeInTheDocument();
  });

  it('suggests replies from what was said, even before any word is picked (demo AI)', async () => {
    const user = userEvent.setup();
    renderApp({ aiProvider: 'demo', aiModel: 'demo' });
    await partnerSays(user, 'Would you like some tea');
    await user.click(screen.getByRole('button', { name: 'Yes…' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, please.' }));
    expect(spoken).toEqual(['Yes, please.']);
  });
});
