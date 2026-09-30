// Message-composing building blocks shared by every communication tool.
export * from './state';
export * from './vocab';
export { SentenceBar } from './SentenceBar';
export { Suggestions } from './Suggestions';
export { SavedPhrases } from './SavedPhrases';
export { WordRows, TileGrid, TILE, tileMin, tone, type TileSize } from './WordRows';
export { BoardArea, type Tab } from './BoardArea';
export { planGrid, fitCount, type Box, type GridPlan } from './fit';
export { useAiConfig } from './useAiConfig';
export { useMyVocabulary, loadMyVocabulary, vocabCategory } from './myWords';
