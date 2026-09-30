import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@access-suite/access-ui';
import { VOCAB_STORAGE_KEY, makeVocabulary, parseVocabulary } from '@access-suite/vocab';
import { App } from './App';

const renderApp = () =>
  render(
    <SettingsProvider>
      <App />
    </SettingsProvider>,
  );

const stored = () => parseVocabulary(localStorage.getItem(VOCAB_STORAGE_KEY)!);

// The review heading takes focus once it has rendered. Wait for that before
// typing elsewhere, so the tests can't race the focus move.
const reviewReady = async () => {
  const heading = await screen.findByRole('heading', { name: '2. Review' }, { timeout: 5000 });
  await waitFor(() => expect(heading).toHaveFocus());
};

describe('Vocabulary Builder', () => {
  it('finds words in the sample, lets you drop and edit them, and saves to the device', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Use sample text' }));
    await user.click(screen.getByRole('button', { name: 'Find words' }));
    await reviewReady();
    expect(screen.getByText(/Found \d+ words and \d+ phrases in 20 messages/)).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Words found' });
    expect(within(table).getByRole('textbox', { name: 'Spelling of Rosa' })).toBeInTheDocument();
    await user.click(within(table).getByRole('checkbox', { name: 'Keep porch' }));
    const theo = within(table).getByRole('textbox', { name: 'Spelling of Theo' });
    await user.clear(theo);
    await user.type(theo, 'Teddy');
    await user.selectOptions(within(table).getByRole('combobox', { name: 'Category for game' }), 'other');

    await user.click(screen.getByRole('button', { name: 'Save to this device' }));
    const file = stored();
    const texts = file.words.map((w) => w.text);
    expect(texts).toContain('Rosa');
    expect(texts).toContain('Teddy');
    expect(texts).not.toContain('Theo');
    expect(texts).not.toContain('porch');
    expect(file.words.find((w) => w.text === 'game')?.category).toBe('other');
    expect(file.phrases.map((p) => p.text)).toContain('photo album');
    expect(screen.getByRole('heading', { name: 'Saved on this device' })).toBeInTheDocument();
  });

  it('adds a word by hand', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByRole('textbox', { name: /paste messages/i }), 'hello there\nhello again');
    await user.click(screen.getByRole('button', { name: 'Find words' }));
    await reviewReady();
    await user.type(screen.getByRole('textbox', { name: 'Add a word or name' }), 'Grandma June');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Save to this device' }));
    expect(stored().words).toContainEqual({ text: 'Grandma June', count: 0, category: 'people' });
  });

  it('rejects a file that is not a vocabulary file', async () => {
    const user = userEvent.setup();
    renderApp();
    const input = screen.getByLabelText('Load a saved word list');
    await user.upload(input, new File(['{"nope":true}'], 'other.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not an Access Suite vocabulary file/);
  });

  it('shows, edits and removes what is saved on the device', async () => {
    localStorage.setItem(
      VOCAB_STORAGE_KEY,
      JSON.stringify(makeVocabulary([{ text: 'Biscuit', count: 3, category: 'people' }], [])),
    );
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByText(/1 words and 0 phrases/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit saved words' }));
    expect(screen.getByRole('textbox', { name: 'Spelling of Biscuit' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove from this device' }));
    expect(localStorage.getItem(VOCAB_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Saved on this device' })).not.toBeInTheDocument();
  });
});
