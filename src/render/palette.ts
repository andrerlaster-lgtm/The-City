/**
 * The shared colour palette. The renderer reads these numbers; the UI mirrors
 * the same values as CSS variables in ui/styles/tokens.css.
 */
export const PALETTE = {
  void: 0x243128,
  grass: 0x8fbf6a,
  grassShade: 0x5f8a45,
  water: 0x5aa9c9,
  sand: 0xe6d29a,
  road: 0x6f6a63,
  roofRed: 0xc4553b,
  wallCream: 0xf2e3c6,
  shadow: 0x1a2219,
} as const;
