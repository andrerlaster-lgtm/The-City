/**
 * Pastel colour schemes for buildings (LF-1, see docs/LOOK-AND-FEEL-IDEAS.md).
 * Pure data and helpers, no Pixi: the art module prebuilds one texture per scheme,
 * and each placed building picks its scheme from its id, so it never changes colour.
 */

export interface BuildingScheme {
  /** The sunlit (left) wall. */
  wall: number;
  roof: number;
  /** Door and window frames. */
  trim: number;
}

export const BUILDING_SCHEMES: readonly BuildingScheme[] = [
  { wall: 0xffb5a7, roof: 0xe9968c, trim: 0xfff1ec }, // peach
  { wall: 0xfcd5ce, roof: 0xe6a79e, trim: 0xfff7f4 }, // blush
  { wall: 0xb8e0d2, roof: 0x8ec3af, trim: 0xf2fbf7 }, // mint
  { wall: 0xcdb4db, roof: 0xa991c4, trim: 0xf8f2fb }, // lavender
];

/** Art keys drawn once per scheme. Other art (farm, well, …) has a single look. */
export const SCHEMED_ART: ReadonlySet<string> = new Set(['cottage', 'rowhouse', 'workshop']);

/** The texture key for one scheme of an art key. */
export function schemeKey(art: string, scheme: number): string {
  return `${art}#${scheme}`;
}

/**
 * The texture key a placed building draws with. Neighbouring ids get different
 * schemes, so a street of new homes alternates colours.
 */
export function buildingTextureKey(art: string, buildingId: number): string {
  if (!SCHEMED_ART.has(art)) return art;
  const count = BUILDING_SCHEMES.length;
  return schemeKey(art, ((buildingId % count) + count) % count);
}

/** Scales a colour's channels by `factor` (below 1 darkens), for shaded faces. */
export function shadeColor(color: number, factor: number): number {
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((color >> shift) & 0xff) * factor)));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
