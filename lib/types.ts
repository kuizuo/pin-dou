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

export type ProjectVersion = {
  id: string;
  name: string;
  kind: "auto" | "manual";
  createdAt: string;
  reason:
    | "首次生成"
    | "重新生成"
    | "参数调整"
    | "整色替换"
    | "自动备份"
    | "恢复版本"
    | "手动保存";
  pattern: Pattern;
};

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
  versions: ProjectVersion[];
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
  longestEdge: 70,
  maxColors: 20,
  paletteSize: 291,
  excludedColorIds: [],
  processingMode: "edge",
  colorMerge: 5,
  background: "plain",
  mirror: false,
  mode: "local",
};
