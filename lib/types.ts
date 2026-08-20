export type BeadColor = {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
  lab: [number, number, number];
};

export type ProcessingMode = "edge" | "dominant" | "average";
export type BackgroundMode = "plain" | "keep";
export type GenerationMode = "local" | "ai";
export type SourceVariant
  = | "original"
    | "ai-pixel"
    | "ai-cartoon"
    | "ai-realistic";

export type CardPreset = {
  id: "standard-card";
  name: string;
  width: number;
  height: number;
  description: string;
};

export const CARD_PRESETS: CardPreset[] = [
  {
    id: "standard-card",
    name: "银行卡 / 身份证",
    width: 17,
    height: 11,
    description: "17 × 11 格 · 约 85.6 × 54 mm",
  },
];

export type SourceTransform = {
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  zoom: number;
  offsetX: number;
  offsetY: number;
  crop?: { x: number; y: number; width: number; height: number };
};

export type GenerationSettings = {
  longestEdge: number;
  maxColors: number;
  paletteSize: number;
  excludedColorIds: string[];
  processingMode: ProcessingMode;
  colorMerge: number;
  background: BackgroundMode;
  mirror: boolean;
  mode: GenerationMode;
};

export type Pattern = {
  id: string;
  name: string;
  width: number;
  height: number;
  cells: Array<string | null>;
  backgroundCells?: Array<string | null>;
  createdAt: string;
  sourcePreview?: string;
  contentBounds?: { x: number; y: number; width: number; height: number };
};

export type PatternStats = Array<{ color: BeadColor; count: number }>;

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: Blob;
  sourceName: string;
  sourceType: string;
  generatedSource?: Blob;
  sourceVariant: SourceVariant;
  processedSource?: Blob;
  backgroundRemoved?: boolean;
  transform: SourceTransform;
  settings: GenerationSettings;
  pattern: Pattern;
};

export type AiVariant = "pixel";

export const DEFAULT_TRANSFORM: SourceTransform = {
  rotation: 0,
  flipX: false,
  flipY: false,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};
export const DEFAULT_SETTINGS: GenerationSettings = {
  longestEdge: 65,
  maxColors: 12,
  paletteSize: 291,
  excludedColorIds: [],
  processingMode: "edge",
  colorMerge: 5,
  background: "plain",
  mirror: false,
  mode: "local",
};
