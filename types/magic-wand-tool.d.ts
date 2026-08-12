declare module "magic-wand-tool" {
  type Image = { data: Uint8ClampedArray; width: number; height: number; bytes: number };
  type Mask = { data: Uint8Array; width: number; height: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } };
  const MagicWand: {
    floodFill: (image: Image, x: number, y: number, threshold: number, visited?: Uint8Array, includeBorders?: boolean) => Mask | null;
  };
  export default MagicWand;
}
