import { snapPoint, snapToAngle, snapToGrid } from './snapUtils';

describe('snapUtils', () => {
  it('snaps to the nearest allowed angle', () => {
    const radius = 1000;
    const angleRad = (47 * Math.PI) / 180;
    const point = {
      x_mm: Math.cos(angleRad) * radius,
      y_mm: Math.sin(angleRad) * radius
    };

    const snapped = snapToAngle(point, { x_mm: 0, y_mm: 0 }, [0, 45, 90]);

    expect(snapped.x_mm).toBeCloseTo(Math.cos(Math.PI / 4) * radius, 5);
    expect(snapped.y_mm).toBeCloseTo(Math.sin(Math.PI / 4) * radius, 5);
  });

  it('snaps to the nearest grid point', () => {
    expect(snapToGrid({ x_mm: 1234, y_mm: 1766 }, 100)).toEqual({
      x_mm: 1200,
      y_mm: 1800
    });
  });

  it('combines grid and angle snapping', () => {
    const snapped = snapPoint({ x_mm: 980, y_mm: 1020 }, { x_mm: 0, y_mm: 0 }, 100, true);

    expect(snapped).toEqual({ x_mm: 1000, y_mm: 1000 });
  });
});
