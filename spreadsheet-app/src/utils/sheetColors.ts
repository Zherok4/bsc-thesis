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
 * Excluded hue ranges to avoid colors that conflict with important UI elements.
 * Each range is [start, end] in degrees (0-360).
 * - Purple (260-300): Used for selection highlighting
 * - Blue (200-245): Used for UI elements (buttons, headers)
 * - Amber (30-55): Used for warnings and highlights
 */
const EXCLUDED_HUE_RANGES: [number, number][] = [
  [30, 55],    // Amber
  [200, 245],  // Blue
  [260, 300],  // Purple
];

/**
 * Calculates the total available hue space after excluding reserved ranges.
 */
function getAvailableHueSpace(): number {
  const excludedTotal = EXCLUDED_HUE_RANGES.reduce(
    (sum, [start, end]) => sum + (end - start),
    0
  );
  return 360 - excludedTotal;
}

/**
 * Maps a position in available hue space (0 to availableSpace) to actual hue (0-360),
 * skipping over excluded ranges.
 * @param position - Position in the available (non-excluded) hue space
 * @returns The actual hue value after skipping excluded ranges
 */
function mapToActualHue(position: number): number {
  const availableSpace = getAvailableHueSpace();
  const normalizedPosition = ((position % availableSpace) + availableSpace) % availableSpace;

  let currentHue = 0;
  let remainingPosition = normalizedPosition;

  // Sort excluded ranges by start hue
  const sortedRanges = [...EXCLUDED_HUE_RANGES].sort((a, b) => a[0] - b[0]);

  for (const [start, end] of sortedRanges) {
    const availableBefore = start - currentHue;

    if (remainingPosition < availableBefore) {
      return currentHue + remainingPosition;
    }

    remainingPosition -= availableBefore;
    currentHue = end;
  }

  // Handle remaining space after all excluded ranges
  return currentHue + remainingPosition;
}

/**
 * Generates a consistent color pair for a sheet based on its ID.
 * Uses golden ratio distribution within non-excluded hue ranges
 * for maximum visual distinction between colors.
 *
 * @param sheetId - The numeric sheet ID (stable identifier from HyperFormula)
 * @returns ColorPair with accent (for text/borders) and accentLight (for backgrounds)
 */
export function getSheetColors(sheetId: number): SheetColorPair {
  const availableSpace = getAvailableHueSpace();
  const position = (sheetId * GOLDEN_RATIO_CONJUGATE * availableSpace) % availableSpace;
  const hue = mapToActualHue(position);

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
