/**
 * The sky behind the map (LF-2): a screen-sized vertical gradient that follows the
 * time of day. It sits under the camera, so panning and zooming don't move it.
 */
import { FillGradient, Graphics } from 'pixi.js';

export class SkyLayer {
  readonly graphics = new Graphics({ label: 'sky', eventMode: 'none' });
  private gradient: FillGradient | null = null;
  private colours: [number, number] | null = null;
  private size = { width: 0, height: 0 };

  /** Redraws only when the colours or the screen size changed. */
  update(top: number, bottom: number, width: number, height: number): void {
    const same = this.colours?.[0] === top && this.colours[1] === bottom && this.size.width === width && this.size.height === height;
    if (same) return;
    this.colours = [top, bottom];
    this.size = { width, height };
    this.gradient?.destroy();
    this.gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [{ offset: 0, color: top }, { offset: 1, color: bottom }],
      textureSpace: 'local',
    });
    this.graphics.clear().rect(0, 0, width, height).fill(this.gradient);
  }

  destroy(): void {
    this.gradient?.destroy();
    this.graphics.destroy();
  }
}
