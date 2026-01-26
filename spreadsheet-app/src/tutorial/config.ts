/**
 * Tutorial system configuration.
 * Both features can be independently enabled/disabled.
 */

/**
 * Master switch for auto-loading the tutorial spreadsheet on app startup.
 * Disabled by default. Use VITE_TUTORIAL_SPREADSHEET_ENABLED=true to enable.
 */
export const TUTORIAL_SPREADSHEET_ENABLED: boolean =
    import.meta.env.VITE_TUTORIAL_SPREADSHEET_ENABLED === 'true';

/**
 * Master switch for the interactive tutorial feature.
 * Set to false or use VITE_TUTORIAL_ENABLED=false to disable.
 */
export const TUTORIAL_ENABLED: boolean =
    import.meta.env.VITE_TUTORIAL_ENABLED !== 'false';
