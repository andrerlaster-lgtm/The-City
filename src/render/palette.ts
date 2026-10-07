/**
 * The shared colour palette. The renderer reads these numbers; the UI mirrors
 * the same values as CSS variables in ui/styles/tokens.css.
 * Light comes from the upper left: left-facing surfaces are lighter.
 */
export const PALETTE = {
  void: 0x243128,
  grass: 0x8fbf6a,
  grassLight: 0xa6cf7c,
  grassDark: 0x76a656,
  sand: 0xe8d6a0,
  sandDark: 0xd6c088,
  water: 0x5aa9c9,
  waterLight: 0x8cc9de,
  waterDeep: 0x3f8db0,
  soilLight: 0x9a7350,
  soilDark: 0x6e4f37,
  trunk: 0x7a5236,
  leafLight: 0x7fb85a,
  leaf: 0x5e9a45,
  leafDark: 0x447a36,
  pineLight: 0x5a9a5c,
  pine: 0x3f7d4a,
  pineDark: 0x2e5f3a,
  road: 0x6f6a63,
  roadDisconnected: 0xa8705a,
  roofRed: 0xc4553b,
  wallCream: 0xf2e3c6,
  /** Building lots, doors and the workshop roof (pastel schemes: art/buildingSchemes.ts). */
  lotGround: 0xc9ad8c,
  door: 0x9a7b8f,
  slateRoof: 0x8fa3b8,
  shadow: 0x1a2219,
  highlight: 0xfff6dc,
  /** Road-access hints and map markers. */
  accessGood: 0x72ef9b,
  accessWarn: 0xffb347,
  accessHint: 0xfff1b8,
  entrance: 0xffd36b,
  /** Map overlays (see render/overlays.ts). */
  overlayGood: 0x4fc3f7,
  overlayWarn: 0xffb347,
  overlayBad: 0xef5350,
} as const;
