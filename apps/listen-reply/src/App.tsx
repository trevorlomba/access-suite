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
  CATEGORIES,
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
  useSavedPhrases,
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

export function App() {
  const { speak } = useSpeak();
  const { freq, record } = useFrequencies();
  const { saved, add: savePhrase, remove: removePhrase } = useSavedPhrases();
  const aiConfig = useAiConfig();

  const [history, setHistory] = useState<Utterance[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tokens, dispatch] = useReducer(messageReducer, []);
  const [selected, setSelected] = useState<number | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCore, setShowCore] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const addUtterance = useCallback((text: string) => {
    const u = analyzeUtterance(text);
    if (!u.text) return;
    // Keep any reply in progress: the partner may keep talking while the user composes.
    setHistory((h) => [u, ...h].slice(0, HISTORY));
    setCurrentIndex(0);
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

  return (
    <div className="tool">
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

      <main className="tool-main">
        <div className="tool-compose">
          <section className="heard" aria-labelledby="heard-heading">
            <h2 id="heard-heading" className="section-title">
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
              <BigButton onClick={() => setPartnerTyping(true)}>✎ Type what they said</BigButton>
              {history.length > 0 && (
                <BigButton variant="quiet" onClick={() => setHistory([])}>
                  Clear
                </BigButton>
              )}
            </ScanGroup>
            <p className="help">
              {listen.supported
                ? 'Your browser turns speech into text. Some browsers (like Chrome) send the audio to their own servers to do this.'
                : 'This browser can’t turn speech into text. The other person can type what they said instead.'}
            </p>
            {listen.error && (
              <p className="error" role="alert">
                {listen.error}
              </p>
            )}

            <div className="heard__current" aria-live="polite">
              {listen.interim && <p className="heard__interim">{listen.interim}…</p>}
              {current ? (
                <>
                  <p className="heard__text">“{current.text}”</p>
                  <span className="badge">{KIND_LABEL[current.kind]}</span>
                </>
              ) : (
                !listen.interim && <p className="muted">Nothing yet. Press Listen, or have them type.</p>
              )}
            </div>

            {history.length > 1 && (
              <>
                <ScanGroup label="Show earlier">
                  <BigButton variant="quiet" aria-expanded={showEarlier} onClick={() => setShowEarlier((s) => !s)}>
                    {showEarlier ? 'Hide earlier' : `Earlier (${history.length - 1})`}
                  </BigButton>
                </ScanGroup>
                {showEarlier && (
                  <ScanGroup label="Reply to something said earlier" layout="stack">
                    {history.map((u, i) =>
                      i === currentIndex ? null : (
                        <BigButton
                          key={`${i}-${u.text}`}
                          variant="quiet"
                          className="heard__earlier"
                          onClick={() => {
                            setCurrentIndex(i);
                            setShowEarlier(false);
                          }}
                        >
                          “{u.text}”
                        </BigButton>
                      ),
                    )}
                  </ScanGroup>
                )}
              </>
            )}
          </section>

          {current && (
            <ScanGroup label="Quick replies" className="quick">
              {quickReplies(current.kind).map((r) => (
                <BigButton key={r} className="quick__reply" onClick={() => say(r, [])}>
                  {r}
                </BigButton>
              ))}
            </ScanGroup>
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
            canSpeak
          />

          {aiConfig && current && (
            <Suggestions
              key={`${current.text}|${words.join(' ')}`}
              config={aiConfig}
              words={words}
              context={current.text}
              onChoose={(s) => say(s, words)}
            />
          )}

          {current && (
            <section className="board" aria-labelledby="their-words-heading">
              <h2 id="their-words-heading" className="section-title">
                Their words
              </h2>
              {current.phrases.length > 0 && (
                <ScanGroup label="Their phrases" className="phrases">
                  {current.phrases.map((p) => (
                    <BigButton key={p} className="phrase" onClick={() => addWord(p)}>
                      {p}
                    </BigButton>
                  ))}
                </ScanGroup>
              )}
              <WordRows
                words={current.words.map((text) => ({ text, kind: 'misc' as const }))}
                label="Their words"
                freq={freq}
                onPick={addWord}
              />
            </section>
          )}

          <section className="board" aria-labelledby="my-words-heading">
            <h2 id="my-words-heading" className="section-title">
              My words
            </h2>
            <ScanGroup label="Pronouns" className="pronouns">
              {PRONOUNS.map((p) => (
                <BigButton key={p.text} tone={tone(p)} onClick={() => addWord(p)}>
                  {p.text}
                </BigButton>
              ))}
            </ScanGroup>
            <ScanGroup label="Show core words">
              <BigButton variant="quiet" aria-expanded={showCore} onClick={() => setShowCore((s) => !s)}>
                {showCore ? 'Hide core words' : 'More words'}
              </BigButton>
            </ScanGroup>
            {showCore && <WordRows words={CORE} label="Core words" freq={freq} onPick={addWord} />}
          </section>
        </div>

        <aside className="tool-side">
          <SavedPhrases saved={saved} onSpeak={(p) => say(p, p.split(/\s+/))} onRemove={removePhrase} />
        </aside>
      </main>

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
