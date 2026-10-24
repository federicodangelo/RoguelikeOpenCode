export type ScalingMode = "integer" | "fractional" | "smooth";

export const SCALING_MODES: ScalingMode[] = ["integer", "fractional", "smooth"];

export interface CanvasFit {
  cssW: number;
  cssH: number;
  backingW: number;
  backingH: number;
}

export function computeScaling(
  mode: ScalingMode,
  logicalW: number,
  logicalH: number,
  fit: number,
  dpr: number,
): CanvasFit {
  if (mode === "integer") {
    const factor = Math.max(1, Math.floor(fit * dpr));
    const backingW = logicalW * factor;
    const backingH = logicalH * factor;
    // The smallest whole factor is 1, so when fit*dpr < 1 the backing store is bigger than the
    // viewport. Show it at the fitted size instead of pushing the canvas off screen; the extra
    // backing pixels are downsampled by the browser.
    return {
      cssW: Math.min(backingW / dpr, logicalW * fit),
      cssH: Math.min(backingH / dpr, logicalH * fit),
      backingW,
      backingH,
    };
  }
  if (mode === "fractional") {
    const scale = Math.max(0.25, Math.floor(fit * 4) / 4);
    const cssW = logicalW * scale;
    const cssH = logicalH * scale;
    return {
      cssW,
      cssH,
      backingW: Math.round(cssW * dpr),
      backingH: Math.round(cssH * dpr),
    };
  }
  const cssW = Math.round(logicalW * fit);
  const cssH = Math.round(logicalH * fit);
  return {
    cssW,
    cssH,
    backingW: Math.round(cssW * dpr),
    backingH: Math.round(cssH * dpr),
  };
}
