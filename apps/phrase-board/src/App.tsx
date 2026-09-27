import { useReducer, useState } from 'react';
import { BigButton, Dialog, OnScreenKeyboard, ScanGroup, SettingsPanel, useSpeak } from '@access-suite/access-ui';
import {
  CATEGORIES,
  LETTERS,
  PRONOUNS,
  SavedPhrases,
  SentenceBar,
  Suggestions,
  WordRows,
  messageReducer,
  messageText,
  tone,
  useAiConfig,
  useFrequencies,
  useMyVocabulary,
  useSavedPhrases,
  vocabCategory,
  wordsStartingWith,
  type Word,
} from '@access-suite/board';

type View = { kind: 'category'; id: string } | { kind: 'letters' } | { kind: 'letter'; letter: string };

export function App() {
  const { speak, supported: canSpeakAloud } = useSpeak();
  const { freq, record } = useFrequencies();
  const { saved, add: savePhrase, remove: removePhrase } = useSavedPhrases();

  // Personal vocabulary from the Vocabulary Builder, shown first when present.
  const myVocab = useMyVocabulary();
  const mine = vocabCategory(myVocab);
  const categories = mine ? [mine, ...CATEGORIES] : CATEGORIES;

  const [tokens, dispatch] = useReducer(messageReducer, []);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<View>({ kind: 'category', id: categories[0]!.id });
  const [typing, setTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const aiConfig = useAiConfig();

  const say = (text: string, words: string[]) => {
    speak(text);
    record(words);
    setAnnouncement(`Spoke: ${text}`);
  };

  const addWord = (w: Word | string) => {
    dispatch({ type: 'add', text: typeof w === 'string' ? w : w.text });
    setSelected(null);
    if (view.kind === 'letter') setView({ kind: 'letters' });
  };

  const words = tokens.map((t) => t.text);
  const current =
    view.kind === 'category' ? (categories.find((c) => c.id === view.id) ?? categories[0]) : undefined;
  const myPhrases = current?.id === 'mine' ? (myVocab?.phrases ?? []) : [];

  return (
    <div className="tool">
      <header className="tool-header">
        <h1>Phrase Board</h1>
        <ScanGroup label="Tools" className="tool-header__tools">
          <a href="../" className="big-btn big-btn--quiet home-link" data-scan-item="">
            ⌂ All tools
          </a>
          <BigButton onClick={() => setTyping(true)}>⌨ Type</BigButton>
          <BigButton onClick={() => setSettingsOpen(true)}>⚙ Settings</BigButton>
        </ScanGroup>
      </header>

      {!canSpeakAloud && (
        <p className="warn" role="status">
          This browser can’t speak aloud. Your message is shown large on screen so others can read it.
        </p>
      )}

      <main className="tool-main">
        <div className="tool-compose">
          <SentenceBar
            tokens={tokens}
            selected={selected}
            onSelect={setSelected}
            dispatch={dispatch}
            onSpeak={() => say(messageText(tokens), words)}
            onSave={() => {
              savePhrase(messageText(tokens));
              setAnnouncement('Saved.');
            }}
            canSpeak
          />

          {aiConfig && (
            <Suggestions key={words.join(' ')} config={aiConfig} words={words} onChoose={(s) => say(s, words)} />
          )}

          <section className="board" aria-labelledby="board-heading">
            <h2 id="board-heading" className="visually-hidden">
              Word board
            </h2>
            <ScanGroup label="Pronouns" className="pronouns">
              {PRONOUNS.map((p) => (
                <BigButton key={p.text} tone={tone(p)} onClick={() => addWord(p)}>
                  {p.text}
                </BigButton>
              ))}
            </ScanGroup>

            <ScanGroup label="Word categories" className="tabs">
              {categories.map((c) => {
                const active = current?.id === c.id;
                return (
                  <BigButton
                    key={c.id}
                    className="tab"
                    tone={active ? undefined : tone({ text: c.label, kind: c.kind })}
                    variant={active ? 'primary' : 'default'}
                    aria-pressed={active}
                    onClick={() => setView({ kind: 'category', id: c.id })}
                  >
                    {c.label}
                  </BigButton>
                );
              })}
              <BigButton
                className="tab"
                variant={view.kind !== 'category' ? 'primary' : 'default'}
                aria-pressed={view.kind !== 'category'}
                onClick={() => setView({ kind: 'letters' })}
              >
                A–Z
              </BigButton>
            </ScanGroup>

            {myPhrases.length > 0 && (
              <ScanGroup label="My phrases" className="phrases">
                {myPhrases.map((p) => (
                  <BigButton key={p.text} className="phrase" onClick={() => addWord(p.text)}>
                    {p.text}
                  </BigButton>
                ))}
              </ScanGroup>
            )}

            {current && <WordRows words={current.words} label={current.id === 'mine' ? 'My words' : `${current.label} words`} freq={freq} onPick={addWord} />}

            {view.kind === 'letters' && (
              <div className="letters" role="group" aria-label="Find a word by its first letter">
                {[LETTERS.slice(0, 9), LETTERS.slice(9, 18), LETTERS.slice(18)].map((row) => (
                  <ScanGroup key={row[0]} label={`Letters ${row[0]!.toUpperCase()} to ${row[row.length - 1]!.toUpperCase()}`} className="letter-row">
                    {row.map((l) => (
                      <BigButton key={l} onClick={() => setView({ kind: 'letter', letter: l })} aria-label={`Words starting with ${l}`}>
                        {l.toUpperCase()}
                      </BigButton>
                    ))}
                  </ScanGroup>
                ))}
              </div>
            )}

            {view.kind === 'letter' && (
              <>
                <ScanGroup label="Back to letters">
                  <BigButton variant="quiet" onClick={() => setView({ kind: 'letters' })}>
                    ◀ Letters
                  </BigButton>
                </ScanGroup>
                <WordRows
                  words={wordsStartingWith(view.letter, mine?.words)}
                  label={`Words starting with ${view.letter.toUpperCase()}`}
                  freq={freq}
                  onPick={addWord}
                />
              </>
            )}
          </section>
        </div>

        <aside className="tool-side">
          <SavedPhrases saved={saved} onSpeak={(p) => say(p, p.split(/\s+/))} onRemove={removePhrase} />
        </aside>
      </main>

      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      <OnScreenKeyboard open={typing} onClose={() => setTyping(false)} onSubmit={(t) => addWord(t)} />

      <Dialog open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <SettingsPanel />
      </Dialog>
    </div>
  );
}
