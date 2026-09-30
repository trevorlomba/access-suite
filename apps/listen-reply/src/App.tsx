import { useCallback, useId, useReducer, useState } from 'react';
import {
  BigButton,
  Dialog,
  OnScreenKeyboard,
  ScanGroup,
  SettingsPanel,
  useListen,
  useSpeak,
} from '@access-suite/access-ui';
import {
  BoardArea,
  CATEGORIES,
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
  type Tab,
  type Word,
} from '@access-suite/board';
import { analyzeUtterance, quickReplies, type Utterance } from '@access-suite/board/transcript';

const HISTORY = 6;
const CORE = CATEGORIES.find((c) => c.id === 'core')!.words;

const KIND_LABEL: Record<Utterance['kind'], string> = {
  'yes-no-question': 'Yes/no question',
  question: 'Question',
  command: 'Request',
  statement: 'Statement',
};

const CORE_TAB = 'core';
const THEIR_TAB = 'their';
const SAVED_TAB = 'saved';

export function App() {
  const { speak } = useSpeak();
  const { freq, record } = useFrequencies();
  const { saved, add: savePhrase, remove: removePhrase } = useSavedPhrases();
  const aiConfig = useAiConfig();
  const mine = vocabCategory(useMyVocabulary());

  const [history, setHistory] = useState<Utterance[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tokens, dispatch] = useReducer(messageReducer, []);
  const [selected, setSelected] = useState<number | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<string>(() => (mine ? mine.id : CORE_TAB));
  /** Something shown in place of the board for a moment. */
  const [overlay, setOverlay] = useState<'earlier' | 'suggest' | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const addUtterance = useCallback((text: string) => {
    const u = analyzeUtterance(text);
    if (!u.text) return;
    // Keep any reply in progress: the partner may keep talking while the user composes.
    setHistory((h) => [u, ...h].slice(0, HISTORY));
    setCurrentIndex(0);
    setTab(THEIR_TAB);
    setOverlay(null);
  }, []);

  const listen = useListen({ onUtterance: addUtterance });
  const current = history[currentIndex];
  const words = tokens.map((t) => t.text);

  const say = (text: string, used: string[]) => {
    speak(text);
    record(used);
    setAnnouncement(`Spoke: ${text}`);
  };
  const addWord = (w: Word | string) => {
    dispatch({ type: 'add', text: typeof w === 'string' ? w : w.text });
    setSelected(null);
  };
  const openTab = (id: string) => {
    setTab(id);
    setOverlay(null);
  };

  const tabs: Tab[] = [
    ...(current ? [{ id: THEIR_TAB, label: 'Their words' }] : []),
    ...(mine ? [{ id: mine.id, label: mine.label, tone: tone({ text: mine.label, kind: mine.kind }) }] : []),
    { id: CORE_TAB, label: 'Core', tone: tone({ text: 'Core', kind: 'verb' }) },
    { id: SAVED_TAB, label: '★ Saved' },
  ];
  const shownTab = tab === THEIR_TAB && !current ? (mine ? mine.id : CORE_TAB) : tab;

  let board;
  if (overlay === 'suggest' && aiConfig && current) {
    board = (
      <Suggestions
        key={`${current.text}|${words.join(' ')}`}
        config={aiConfig}
        words={words}
        context={current.text}
        onChoose={(s) => say(s, words)}
        onBack={() => setOverlay(null)}
      />
    );
  } else if (overlay === 'earlier') {
    board = (
      <TileGrid
        items={history.map((u, i) => ({ u, i })).filter(({ i }) => i !== currentIndex)}
        label="Reply to something said earlier"
        name={({ u }) => u.text}
        size="phrase"
        render={({ u, i }) => (
          <BigButton
            variant="quiet"
            className="phrase-tile heard__earlier"
            onClick={() => {
              setCurrentIndex(i);
              setOverlay(null);
              setTab(THEIR_TAB);
            }}
          >
            “{u.text}”
          </BigButton>
        )}
      />
    );
  } else if (shownTab === SAVED_TAB) {
    board = <SavedPhrases saved={saved} onSpeak={(p) => say(p, p.split(/\s+/))} onRemove={removePhrase} />;
  } else if (shownTab === THEIR_TAB && current) {
    // Their phrases first (whole chunks they said), then their words.
    board = (
      <WordRows
        words={[...current.phrases, ...current.words].map((text) => ({ text, kind: 'misc' as const }))}
        label="Their words"
        freq={freq}
        onPick={addWord}
      />
    );
  } else if (mine && shownTab === mine.id) {
    board = <WordRows words={mine.words} label="My words" freq={freq} onPick={addWord} />;
  } else {
    board = <WordRows words={CORE} label="Core words" freq={freq} onPick={addWord} />;
  }

  return (
    <div className="tool tool--fit">
      <header className="tool-header">
        <h1>Listen &amp; Reply</h1>
        <ScanGroup label="Tools" className="tool-header__tools">
          <a href="../" className="big-btn big-btn--quiet home-link" data-scan-item="">
            ⌂ All tools
          </a>
          <BigButton onClick={() => setUserTyping(true)}>⌨ Type</BigButton>
          <BigButton onClick={() => setSettingsOpen(true)}>⚙ Settings</BigButton>
        </ScanGroup>
      </header>

      <section className="heard" aria-labelledby="heard-heading">
        <h2 id="heard-heading" className="visually-hidden">
          They said
        </h2>
        <ScanGroup label="Capture what they said" className="heard__controls">
          {listen.supported &&
            (listen.listening ? (
              <BigButton variant="danger" onClick={listen.stop}>
                ■ Stop listening
              </BigButton>
            ) : (
              <BigButton variant="primary" onClick={listen.start}>
                🎤 Listen
              </BigButton>
            ))}
          <BigButton onClick={() => setPartnerTyping(true)} aria-label="Type what they said">
            ✎ Type<span className="wide-only"> what they said</span>
          </BigButton>
          {history.length > 1 && (
            <BigButton
              variant="quiet"
              aria-pressed={overlay === 'earlier'}
              onClick={() => setOverlay((o) => (o === 'earlier' ? null : 'earlier'))}
            >
              {`Earlier (${history.length - 1})`}
            </BigButton>
          )}
          {history.length > 0 && (
            <BigButton
              variant="quiet"
              onClick={() => {
                setHistory([]);
                setOverlay(null);
              }}
            >
              Clear
            </BigButton>
          )}
        </ScanGroup>

        <div className="heard__current" aria-live="polite">
          {listen.interim && <p className="heard__interim">{listen.interim}…</p>}
          {current ? (
            <p className="heard__said">
              <span className="heard__text">“{current.text}”</span> <span className="badge">{KIND_LABEL[current.kind]}</span>
            </p>
          ) : (
            !listen.interim && (
              <p className="muted heard__empty">
                Nothing yet. Press Listen, or have them type.{' '}
                {listen.supported
                  ? 'Your browser turns speech into text. Some browsers (like Chrome) send the audio to their own servers to do this.'
                  : 'This browser can’t turn speech into text. The other person can type what they said instead.'}
              </p>
            )
          )}
        </div>
        {listen.error && (
          <p className="error" role="alert">
            {listen.error}
          </p>
        )}
      </section>

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
        onSuggest={aiConfig ? { open: () => setOverlay('suggest'), disabled: !current } : undefined}
        // Quick replies are the other way to answer, so they share the message's place.
        whenEmpty={
          current && (
            <TileGrid
              items={quickReplies(current.kind)}
              label="Quick replies"
              name={(r) => r}
              size="reply"
              fill={false}
              maxRows={1}
              render={(r) => (
                <BigButton className="quick__reply" onClick={() => say(r, [])}>
                  {r}
                </BigButton>
              )}
            />
          )
        }
        canSpeak
      />

      <BoardArea
        heading="Words for your reply"
        tabs={overlay === 'suggest' && aiConfig && current ? null : tabs}
        active={overlay ? null : shownTab}
        onSelect={openTab}
        top={
          // The AI panel stands in for the whole board, pronouns included.
          overlay !== 'suggest' && (
            <WordRows words={PRONOUNS} label="Pronouns" freq={freq} onPick={addWord} fill={false} maxRows={1} size="short" />
          )
        }
      >
        {board}
      </BoardArea>

      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      <PartnerInput open={partnerTyping} onClose={() => setPartnerTyping(false)} onSubmit={addUtterance} />
      <OnScreenKeyboard open={userTyping} onClose={() => setUserTyping(false)} onSubmit={(t) => addWord(t)} />
      <Dialog open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <SettingsPanel />
      </Dialog>
    </div>
  );
}

/** For the conversation partner: an ordinary text box (they can type normally). */
function PartnerInput({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (t: string) => void }) {
  const [text, setText] = useState('');
  const id = useId();
  const close = () => {
    setText('');
    onClose();
  };
  return (
    <Dialog open={open} title="What did they say?" onClose={close}>
      <form
        className="partner-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSubmit(text.trim());
          close();
        }}
      >
        <label htmlFor={id}>Type what you said to them</label>
        <textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <ScanGroup label="Submit">
          <BigButton type="submit" variant="primary" disabled={!text.trim()}>
            Add
          </BigButton>
        </ScanGroup>
      </form>
    </Dialog>
  );
}
