/// <reference lib="webworker" />
import { runPipeline, type PipelineOptions, type Source } from '@access-suite/vocab';

// Runs the NLP pipeline off the main thread so large inputs don't freeze the page.
self.onmessage = (e: MessageEvent<{ sources: Source[]; options: Partial<PipelineOptions> }>) => {
  try {
    self.postMessage({ ok: true, result: runPipeline(e.data.sources, e.data.options) });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
