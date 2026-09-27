import type { PipelineOptions, PipelineResult, Source } from '@access-suite/vocab';

/** Run the vocabulary pipeline in a Web Worker, or inline where workers aren't available (tests). */
export function analyze(sources: Source[], options: Partial<PipelineOptions>): Promise<PipelineResult> {
  if (typeof Worker === 'undefined') {
    return import('@access-suite/vocab').then((m) => m.runPipeline(sources, options));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ ok: true; result: PipelineResult } | { ok: false; error: string }>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Could not process the text.'));
    };
    worker.postMessage({ sources, options });
  });
}
