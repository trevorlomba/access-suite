import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, SettingsPanel, writeJSON } from '@access-suite/access-ui';
import { allWords, loadMyVocabulary } from '@access-suite/board';
import {
  CATEGORY_LABELS,
  SAMPLE_TEXT,
  VOCAB_STORAGE_KEY,
  makeVocabulary,
  parseVocabulary,
  type PipelineStats,
  type Source,
  type VocabCategory,
  type VocabularyFile,
} from '@access-suite/vocab';
import { analyze } from './analyze';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CATEGORY_IDS = Object.keys(CATEGORY_LABELS) as VocabCategory[];

interface ReviewWord {
  id: number;
  /** As found; used in field labels so they don't change while editing. */
  original: string;
  text: string;
  count: number;
  category: VocabCategory;
  keep: boolean;
}

interface ReviewPhrase {
  id: number;
  text: string;
  count: number;
  keep: boolean;
}

interface Review {
  words: ReviewWord[];
  phrases: ReviewPhrase[];
  stats?: PipelineStats;
}

let nextId = 1;
const toReview = (v: Pick<VocabularyFile, 'words' | 'phrases'>, stats?: PipelineStats): Review => ({
  words: v.words.map((w) => ({ ...w, original: w.text, id: nextId++, keep: true })),
  phrases: v.phrases.map((p) => ({ ...p, id: nextId++, keep: true })),
  stats,
});

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [saved, setSaved] = useState<VocabularyFile | null>(loadMyVocabulary);
  const [pasted, setPasted] = useState('');
  const [files, setFiles] = useState<Source[]>([]);
  const [minCount, setMinCount] = useState(2);
  const [includePhrases, setIncludePhrases] = useState(true);
  const [hideKnown, setHideKnown] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [filter, setFilter] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const ids = { paste: useId(), files: useId(), min: useId(), filter: useId(), importFile: useId() };

  const knownWords = useMemo(() => allWords().map((w) => w.text), []);
  const sources: Source[] = [...(pasted.trim() ? [{ name: 'pasted.txt', content: pasted }] : []), ...files];

  // Move focus to the results for keyboard and screen-reader users. Done after
  // React has rendered them: a requestAnimationFrame could run first, find no
  // heading yet, and silently drop the focus.
  const focusReview = useRef(false);
  useEffect(() => {
    if (review && focusReview.current) {
      focusReview.current = false;
      reviewHeadingRef.current?.focus();
    }
  }, [review]);

  const openReview = (r: Review, message: string) => {
    focusReview.current = true;
    setReview(r);
    setStatus(message);
    setFilter('');
  };

  const addFiles = async (list: FileList | null) => {
    setError(null);
    if (!list) return;
    const added: Source[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name} is larger than 5 MB. Split it into smaller files.`);
        continue;
      }
      added.push({ name: f.name, content: await f.text() });
    }
    setFiles((fs) => [...fs, ...added]);
  };

  const findWords = async () => {
    setError(null);
    setBusy(true);
    setStatus('Finding words…');
    try {
      const result = await analyze(sources, { minCount, includePhrases, hideKnown, knownWords });
      openReview(
        toReview(result, result.stats),
        `Found ${result.words.length} words and ${result.phrases.length} phrases in ${result.stats.documents} messages.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while reading the text.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (list: FileList | null) => {
    setError(null);
    const f = list?.[0];
    if (!f) return;
    try {
      const v = parseVocabulary(await f.text());
      openReview(toReview(v), `Loaded ${v.words.length} words and ${v.phrases.length} phrases from ${f.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const currentFile = (): VocabularyFile | null => {
    if (!review) return null;
    const words = review.words
      .filter((w) => w.keep && w.text.trim())
      .map(({ text, count, category }) => ({ text: text.trim(), count, category }));
    const phrases = review.phrases.filter((p) => p.keep).map(({ text, count }) => ({ text, count }));
    return makeVocabulary(words, phrases);
  };

  const saveToDevice = () => {
    const file = currentFile();
    if (!file) return;
    writeJSON(VOCAB_STORAGE_KEY, file);
    setSaved(loadMyVocabulary());
    setStatus(`Saved ${file.words.length} words and ${file.phrases.length} phrases to this device.`);
  };

  const removeFromDevice = () => {
    try {
      window.localStorage.removeItem(VOCAB_STORAGE_KEY);
    } catch {
      // storage unavailable: nothing to remove
    }
    setSaved(null);
    setStatus('Removed your words from this device.');
  };

  const updateWord = (id: number, patch: Partial<ReviewWord>) =>
    setReview((r) => r && { ...r, words: r.words.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const updatePhrase = (id: number, patch: Partial<ReviewPhrase>) =>
    setReview((r) => r && { ...r, phrases: r.phrases.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const setAllKeep = (keep: boolean) =>
    setReview((r) => r && { ...r, words: r.words.map((w) => ({ ...w, keep })), phrases: r.phrases.map((p) => ({ ...p, keep })) });

  const visibleWords = review?.words.filter((w) => w.text.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const keptCount = review ? review.words.filter((w) => w.keep).length + review.phrases.filter((p) => p.keep).length : 0;

  return (
    <div className="tool builder">
      <header className="tool-header">
        <h1>Vocabulary Builder</h1>
        <nav className="tool-header__tools" aria-label="Tools">
          <a href="../" className="big-btn big-btn--quiet home-link">
            ⌂ All tools
          </a>
          <button type="button" className="big-btn" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </button>
        </nav>
      </header>

      <p className="lede">
        Turn someone’s own messages, notes or transcripts into a personal word list, with names, places and topics
        they actually talk about, for the Phrase Board and Listen &amp; Reply.
      </p>
      <p className="privacy" role="note">
        🔒 Everything happens on this device. Your text is never uploaded, and it stays here until you remove it.
      </p>

      {saved && (
        <section className="card" aria-labelledby="saved-heading">
          <h2 id="saved-heading">Saved on this device</h2>
          <p>
            {saved.words.length} words and {saved.phrases.length} phrases, updated{' '}
            {new Date(saved.createdAt).toLocaleDateString()}. They appear under <strong>My words</strong> in the{' '}
            <a href="../phrase-board/">Phrase Board</a> and <a href="../listen-reply/">Listen &amp; Reply</a>.
          </p>
          <div className="actions">
            <button type="button" className="big-btn" onClick={() => openReview(toReview(saved), 'Editing your saved words.')}>
              Edit saved words
            </button>
            <button type="button" className="big-btn" onClick={() => download('my-vocabulary.json', JSON.stringify(saved, null, 2))}>
              Download a backup
            </button>
            <button type="button" className="big-btn big-btn--danger" onClick={removeFromDevice}>
              Remove from this device
            </button>
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="step1-heading">
        <h2 id="step1-heading">1. Add text</h2>
        <div className="field">
          <label htmlFor={ids.paste}>Paste messages, notes or transcripts (one per line works best)</label>
          <textarea id={ids.paste} rows={7} value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </div>
        <div className="actions">
          <button type="button" className="big-btn" onClick={() => setPasted(SAMPLE_TEXT)}>
            Use sample text
          </button>
        </div>
        <div className="field">
          <label htmlFor={ids.files}>Or add files (.txt, .csv, .json)</label>
          <input
            id={ids.files}
            type="file"
            multiple
            accept=".txt,.md,.csv,.tsv,.json,text/plain,text/csv,application/json"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="help">CSV: the column named “text”, “message” or “transcript” is used, or the wordiest column.</p>
        </div>
        {files.length > 0 && (
          <ul className="file-list" aria-label="Added files">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span>
                  {f.name} <span className="muted">({Math.ceil(f.content.length / 1024)} KB)</span>
                </span>
                <button type="button" className="big-btn big-btn--quiet" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="options">
          <legend>Options</legend>
          <div className="field field--inline">
            <label htmlFor={ids.min}>Only words used at least</label>
            <select id={ids.min} value={minCount} onChange={(e) => setMinCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'time' : 'times'}
                </option>
              ))}
            </select>
          </div>
          <label className="check">
            <input type="checkbox" checked={includePhrases} onChange={(e) => setIncludePhrases(e.target.checked)} />
            Find repeated phrases (2–3 words)
          </label>
          <label className="check">
            <input type="checkbox" checked={hideKnown} onChange={(e) => setHideKnown(e.target.checked)} />
            Skip words already on the board
          </label>
        </fieldset>

        <div className="actions">
          <button type="button" className="big-btn big-btn--primary" onClick={findWords} disabled={busy || sources.length === 0}>
            {busy ? 'Finding words…' : 'Find words'}
          </button>
          <label htmlFor={ids.importFile} className="big-btn file-button">
            Load a saved word list
          </label>
          <input
            ref={importRef}
            id={ids.importFile}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(e) => void importFile(e.target.files)}
          />
        </div>
      </section>

      <div aria-live="polite" className="status">
        {status}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {review && (
        <section className="card" aria-labelledby="step2-heading">
          <h2 id="step2-heading" ref={reviewHeadingRef} tabIndex={-1}>
            2. Review
          </h2>
          <p className="help">
            Untick anything you don’t want, fix spellings, and choose a category. People &amp; names appear first on
            the board.
          </p>
          {review.stats && (
            <p className="muted">
              Read {review.stats.documents} messages · {review.stats.tokens} words · {review.stats.uniqueWords} different
              words
            </p>
          )}

          <div className="review-tools">
            <div className="field field--inline">
              <label htmlFor={ids.filter}>Filter</label>
              <input id={ids.filter} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <button type="button" className="big-btn big-btn--quiet" onClick={() => setAllKeep(true)}>
              Keep all
            </button>
            <button type="button" className="big-btn big-btn--quiet" onClick={() => setAllKeep(false)}>
              Keep none
            </button>
          </div>

          {review.words.length === 0 && review.phrases.length === 0 && (
            <p>No words found. Try adding more text, or lower “used at least”.</p>
          )}

          {review.words.length > 0 && (
            <table className="review-table">
              <caption className="visually-hidden">Words found</caption>
              <thead>
                <tr>
                  <th scope="col">Keep</th>
                  <th scope="col">Word</th>
                  <th scope="col">Uses</th>
                  <th scope="col">Category</th>
                </tr>
              </thead>
              <tbody>
                {visibleWords.map((w) => (
                  <tr key={w.id} className={w.keep ? '' : 'dropped'}>
                    <td>
                      <input type="checkbox" checked={w.keep} onChange={(e) => updateWord(w.id, { keep: e.target.checked })} aria-label={`Keep ${w.original}`} />
                    </td>
                    <td>
                      <input type="text" value={w.text} onChange={(e) => updateWord(w.id, { text: e.target.value })} aria-label={`Spelling of ${w.original}`} />
                    </td>
                    <td className="num">{w.count}</td>
                    <td>
                      <select value={w.category} onChange={(e) => updateWord(w.id, { category: e.target.value as VocabCategory })} aria-label={`Category for ${w.original}`}>
                        {CATEGORY_IDS.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {review.phrases.length > 0 && (
            <fieldset className="phrase-list">
              <legend>Phrases</legend>
              {review.phrases.map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" checked={p.keep} onChange={(e) => updatePhrase(p.id, { keep: e.target.checked })} />
                  {p.text} <span className="muted">({p.count}×)</span>
                </label>
              ))}
            </fieldset>
          )}

          <AddWord onAdd={(text, category) => setReview((r) => r && { ...r, words: [{ id: nextId++, original: text, text, count: 0, category, keep: true }, ...r.words] })} />

          <h2>3. Save</h2>
          <div className="actions">
            <button type="button" className="big-btn big-btn--primary" onClick={saveToDevice} disabled={keptCount === 0}>
              Save to this device
            </button>
            <button type="button" className="big-btn" onClick={() => { const f = currentFile(); if (f) download('my-vocabulary.json', JSON.stringify(f, null, 2)); }} disabled={keptCount === 0}>
              Download file
            </button>
          </div>
          <p className="help">Download the file to move the word list to another device, then use “Load a saved word list” there.</p>
        </section>
      )}

      <Dialog open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <SettingsPanel showAi={false} />
      </Dialog>
    </div>
  );
}

function AddWord({ onAdd }: { onAdd: (text: string, category: VocabCategory) => void }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<VocabCategory>('people');
  const ids = { text: useId(), cat: useId() };
  return (
    <form
      className="add-word"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text.trim(), category);
        setText('');
      }}
    >
      <div className="field">
        <label htmlFor={ids.text}>Add a word or name</label>
        <input id={ids.text} type="text" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={ids.cat}>Category</label>
        <select id={ids.cat} value={category} onChange={(e) => setCategory(e.target.value as VocabCategory)}>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="big-btn" disabled={!text.trim()}>
        Add
      </button>
    </form>
  );
}
