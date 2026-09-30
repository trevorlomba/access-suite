import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessInput, SettingsProvider, type Settings } from '@access-suite/access-ui';
import { App } from './App';

const spoken: string[] = [];

beforeEach(() => {
  spoken.length = 0;
  class Utterance {
    voice: unknown = null;
    rate = 1;
    pitch = 1;
    volume = 1;
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

const message = () => screen.queryByRole('group', { name: /message words/i });

describe('Phrase Board', () => {
  it('builds a message from pronouns and words and speaks it', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(screen.getByRole('group', { name: 'Pronouns' })).getByRole('button', { name: 'I' }));
    await user.click(screen.getByRole('button', { name: 'want' }));
    await user.click(screen.getByRole('button', { name: 'Needs' }));
    await user.click(screen.getByRole('button', { name: 'water' }));
    expect(within(message()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['I', 'want', 'water']);

    await user.click(screen.getByRole('button', { name: /speak/i }));
    expect(spoken).toEqual(['I want water']);
  });

  it('reorders and removes a word', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'want' }));
    await user.click(within(screen.getByRole('group', { name: 'Pronouns' })).getByRole('button', { name: 'I' }));
    await user.click(within(message()!).getByRole('button', { name: /^I,/ }));
    await user.click(screen.getByRole('button', { name: /move left/i }));
    expect(within(message()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['I', 'want']);
    await user.click(within(message()!).getByRole('button', { name: /^want,/ }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(within(message()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['I']);
  });

  it('saves a phrase and speaks it from the saved list', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Social' }));
    await user.click(screen.getByRole('button', { name: 'good morning' }));
    await user.click(screen.getByRole('button', { name: /save/i }));
    const saved = screen.getByRole('group', { name: 'Saved phrases' });
    await user.click(within(saved).getByRole('button', { name: 'Good morning' }));
    expect(spoken).toEqual(['Good morning']);
  });

  it('finds words by first letter across categories', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'A–Z' }));
    await user.click(screen.getByRole('button', { name: 'Words starting with w' }));
    expect(screen.getByRole('button', { name: 'water' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'why' })).toBeInTheDocument();
  });

  it('hides AI when off, and offers demo suggestions that speak when chosen', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    expect(screen.queryByText(/make it a sentence/i)).not.toBeInTheDocument();
    unmount();

    renderApp({ aiProvider: 'demo', aiModel: 'demo' });
    await user.click(screen.getByRole('button', { name: 'Needs' }));
    await user.click(screen.getByRole('button', { name: 'water' }));
    await user.click(screen.getByRole('button', { name: 'Ask it' }));
    const choice = await screen.findByRole('button', { name: 'Can I have water?' });
    await user.click(choice);
    expect(spoken).toEqual(['Can I have water?']);
  });

  it('adds a typed word from the on-screen keyboard', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /type/i }));
    const dialog = screen.getByRole('dialog', { name: 'Type a word' });
    for (const ch of 'cat') await user.click(within(dialog).getByRole('button', { name: ch }));
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(message()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['cat']);
  });
});
