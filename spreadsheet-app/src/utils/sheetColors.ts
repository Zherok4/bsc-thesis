import type { CSSProperties } from "react";

/**
 * Color pair containing accent (text/border) and light (background) colors.
 */
export interface SheetColorPair {
  accent: string;
  accentLight: string;
}

/**
 * Golden ratio conjugate for optimal hue distribution.
 * Using this ensures maximum visual separation between adjacent sheet IDs.
 */
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;

/**
 * Base hue offset to avoid starting at pure red (0 degrees).
 * Starting at ~200 degrees gives a nice blue tone for sheetId 0.
 */
const BASE_HUE_OFFSET = 200;

/**
 * Generates a consistent color pair for a sheet based on its ID.
 * Uses golden ratio distribution for maximum visual distinction between colors.
 *
 * @param sheetId - The numeric sheet ID (stable identifier from HyperFormula)
 * @returns ColorPair with accent (for text/borders) and accentLight (for backgrounds)
 */
export function getSheetColors(sheetId: number): SheetColorPair {
  const hue = ((sheetId * GOLDEN_RATIO_CONJUGATE * 360) + BASE_HUE_OFFSET) % 360;

  const accent = `hsl(${hue}, 55%, 40%)`;
  const accentLight = `hsl(${hue}, 45%, 95%)`;

  return { accent, accentLight };
}

/**
 * Generates CSS custom property values for inline style application.
 * This allows components to override CSS variables dynamically.
 *
 * @param sheetId - The numeric sheet ID
 * @returns CSSProperties object with custom property values
 */
export function getSheetColorStyle(sheetId: number): CSSProperties {
  const colors = getSheetColors(sheetId);
  return {
    "--sheet-accent": colors.accent,
    "--sheet-accent-light": colors.accentLight,
  } as CSSProperties;
}
