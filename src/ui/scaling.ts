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
    return {
      cssW: (logicalW * factor) / dpr,
      cssH: (logicalH * factor) / dpr,
      backingW: logicalW * factor,
      backingH: logicalH * factor,
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
