import { describe, expect, it } from 'vitest';
import { BUILDING_SCHEMES, buildingTextureKey, schemeKey, shadeColor } from '../../src/render/art/buildingSchemes';

describe('pastel building schemes', () => {
  it('gives homes and workshops a scheme from the building id, the same every time', () => {
    expect(buildingTextureKey('cottage', 7)).toBe(schemeKey('cottage', 7 % BUILDING_SCHEMES.length));
    expect(buildingTextureKey('cottage', 7)).toBe(buildingTextureKey('cottage', 7));
    expect(buildingTextureKey('workshop', 4)).toBe(schemeKey('workshop', 0));
  });

  it('gives neighbouring ids different schemes', () => {
    const keys = [1, 2, 3, 4].map((id) => buildingTextureKey('rowhouse', id));
    expect(new Set(keys).size).toBe(BUILDING_SCHEMES.length);
  });

  it('leaves single-look art (farm, well, unknown) on its plain key', () => {
    expect(buildingTextureKey('farm', 3)).toBe('farm');
    expect(buildingTextureKey('well', 9)).toBe('well');
    expect(buildingTextureKey('park', 2)).toBe('park');
  });

  it('shades colours channel by channel and clamps', () => {
    expect(shadeColor(0x808080, 0.5)).toBe(0x404040);
    expect(shadeColor(0xffffff, 2)).toBe(0xffffff);
    expect(shadeColor(0x102030, 0)).toBe(0x000000);
  });
});
