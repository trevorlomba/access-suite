import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './components';

function TypingDialog() {
  const [text, setText] = useState('');
  // A new onClose every render, like most callers pass.
  return (
    <Dialog open title="Note" onClose={() => setText('')}>
      <label htmlFor="t">Text</label>
      <input id="t" value={text} onChange={(e) => setText(e.target.value)} />
    </Dialog>
  );
}

describe('Dialog', () => {
  it('focuses the first field and keeps focus while typing (regression)', async () => {
    const user = userEvent.setup();
    render(<TypingDialog />);
    const input = screen.getByRole('textbox', { name: 'Text' });
    expect(input).toHaveFocus();
    await user.keyboard('hello');
    expect(input).toHaveValue('hello');
    expect(input).toHaveFocus();
  });

  it('closes on Escape using the latest onClose', async () => {
    const user = userEvent.setup();
    render(<TypingDialog />);
    await user.keyboard('abc');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('');
  });
});
