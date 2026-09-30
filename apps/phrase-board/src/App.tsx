import { useReducer, useState } from 'react';
import { BigButton, Dialog, OnScreenKeyboard, ScanGroup, SettingsPanel, useSpeak } from '@access-suite/access-ui';
import {
  BoardArea,
  CATEGORIES,
  LETTERS,
  PRONOUNS,
  SavedPhrases,
  SentenceBar,
  Suggestions,
  TileGrid,
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
  type Tab,
  type Word,
} from '@access-suite/board';

const LETTERS_TAB = 'az';
const SAVED_TAB = 'saved';

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
  const [tab, setTab] = useState(categories[0]!.id);
  const [letter, setLetter] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
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
    setLetter(null);
  };

  const openTab = (id: string) => {
    setTab(id);
    setLetter(null);
    setSuggesting(false);
  };

  const words = tokens.map((t) => t.text);
  const current = categories.find((c) => c.id === tab);
  const tabs: Tab[] = [
    ...categories.map((c) => ({ id: c.id, label: c.label, tone: tone({ text: c.label, kind: c.kind }) })),
    { id: LETTERS_TAB, label: 'A–Z' },
    { id: SAVED_TAB, label: '★ Saved' },
  ];

  let board;
  if (suggesting && aiConfig) {
    board = <Suggestions key={words.join(' ')} config={aiConfig} words={words} onChoose={(s) => say(s, words)} onBack={() => setSuggesting(false)} />;
  } else if (tab === SAVED_TAB) {
    board = <SavedPhrases saved={saved} onSpeak={(p) => say(p, p.split(/\s+/))} onRemove={removePhrase} />;
  } else if (tab === LETTERS_TAB && letter) {
    board = (
      <WordRows
        words={wordsStartingWith(letter, mine?.words)}
        label={`Words starting with ${letter.toUpperCase()}`}
        freq={freq}
        onPick={addWord}
        lead={[
          <BigButton key="back" variant="quiet" onClick={() => setLetter(null)}>
            ◀ Letters
          </BigButton>,
        ]}
      />
    );
  } else if (tab === LETTERS_TAB) {
    board = (
      <TileGrid
        items={LETTERS}
        label="Find a word by its first letter"
        name={(l) => l.toUpperCase()}
        size="short"
        render={(l) => (
          <BigButton className="letter-tile" onClick={() => setLetter(l)} aria-label={`Words starting with ${l}`}>
            {l.toUpperCase()}
          </BigButton>
        )}
      />
    );
  } else if (current) {
    // My own phrases (from the Vocabulary Builder) come before my words.
    const myPhrases: Word[] = current.id === 'mine' ? (myVocab?.phrases ?? []).map((p) => ({ text: p.text, kind: 'misc' })) : [];
    board = (
      <WordRows
        words={[...myPhrases, ...current.words]}
        label={current.id === 'mine' ? 'My words' : `${current.label} words`}
        freq={freq}
        onPick={addWord}
      />
    );
  }

  return (
    <div className="tool tool--fit">
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
        onSuggest={aiConfig ? { open: () => setSuggesting(true), disabled: words.length === 0 } : undefined}
        canSpeak
      />

      <BoardArea
        heading="Word board"
        tabs={suggesting && aiConfig ? null : tabs}
        active={suggesting ? null : tab}
        onSelect={openTab}
        top={
          // The AI panel stands in for the whole board, pronouns included.
          !suggesting && (
            <WordRows words={PRONOUNS} label="Pronouns" freq={freq} onPick={addWord} fill={false} maxRows={1} size="short" />
          )
        }
      >
        {board}
      </BoardArea>

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
