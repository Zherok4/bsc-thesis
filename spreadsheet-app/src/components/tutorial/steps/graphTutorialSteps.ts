import type { TutorialStep } from '../TutorialContext';

/**
 * Tutorial steps focused on teaching the UI mechanics of the flow graph.
 * The sync mechanism is explained first as the primary concept.
 */
export const graphTutorialSteps: TutorialStep[] = [
    {
        id: 'intro-sync',
        targetSelector: '.sync-button',
        title: 'The Sync Mechanism',
        content: 'We\'ve selected cell B3 which contains a formula. Click the sync button to load it into the Flow Graph.',
        position: 'bottom',
        blockSpreadsheet: true,
        awaitClick: '.sync-button',
        action: {
            type: 'selectCell',
            row: 2,  // B3 = row index 2 (0-indexed)
            col: 1,  // B = column index 1
            sheet: 'summary',
        },
    },
    {
        id: 'formula-loaded',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Formula Loaded',
        content: 'This Flow Graph now visualizes the formula for further investigation. It stays until you synchronize to a new formula.',
        position: 'left',
    },
    {
        id: 'switch-cell',
        targetSelector: '.sync-button',
        title: 'Switching Cells',
        content: 'We\'ve now selected a different cell (H3). Click the synchornize button to load this formula',
        position: 'bottom',
        blockSpreadsheet: true,
        awaitClick: '.sync-button',
        action: {
            type: 'selectCell',
            row: 2,  // H3 = row index 2 (0-indexed)
            col: 7,  // H = column index 7
            sheet: 'grades-mathematics',
        },
    },
    {
        id: 'graph-updated',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'New Formula',
        content: 'The graph now shows this weighted average formula.',
        position: 'left',
    },
    {
        id: 'hover-highlight',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Hover to Highlight',
        content: 'Hover over cell reference nodes in the graph. The corresponding cells get highlighted in the spreadsheet.',
        position: 'left',
    },
    {
        id: 'click-navigate',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Click to Navigate',
        content: 'We\'ve moved to a different sheet. Now click on a cell or range node - the spreadsheet will navigate to that location, even across sheets.',
        position: 'left',
        action: {
            type: 'selectCell',
            row: 0,  // A1 = row index 0
            col: 0,  // A = column index 0
            sheet: 'summary',
        },
    },
    {
        id: 'edit-mode',
        targetSelector: '[data-tutorial="edit-mode"]',
        title: 'Edit Mode',
        content: 'Click this button (or double-click a node) to enter Edit Mode. You can then change cell references by selecting new cells.',
        position: 'bottom',
    },
    {
        id: 'complete',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'You\'re Ready!',
        content: 'Explore the formulas in this spreadsheet. Select cells and use the sync button to investigate them.',
        position: 'left',
    },
];
