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
        content: 'We\'ve selected cell B3 which contains a formula. Click the sync button to syncronize it into the Flow Graph.',
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
        content: 'This Flow Graph visualizes the formula of B3 for further investigation. It stays until you synchronize to a new formula.',
        position: 'left',
    },
    {
        id: 'synchronize-button',
        targetSelector: '.current-cell-indicator',
        title: 'Current syncronized cell',
        content: 'This purple button indicates to which cell you are currently synchronized. When you get lost and want to go back to your syncronized cell, just click on this button and it moves you to the syncronized cell in the spreadsheet.',
        position: 'bottom',
    },
    {
        id: 'switch-cell',
        targetSelector: '.sync-button',
        title: 'Switching Cells',
        content: 'We\'ve now selected a different cell (H3). Click the synchronize button to now syncronize to this cell',
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
        content: 'The flow graph now shows the formula of the cell H3.',
        position: 'left',
    },
    {
        id: 'reference-node-type',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Reference Nodes',
        content: 'These nodes represent cell and range references in your formula.',
        position: 'left',
        graphHighlight: {
            nodeTypes: ['ReferenceNode', 'RangeNode'],
            mode: 'pulse',
        },
    },
    {
        id: 'hover-highlight',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Hover to Highlight',
        content: 'Now hover over a reference node to highlight the cell or range in the spreadsheet.',
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
        id: 'edit-reference-nodes',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Edit Reference Nodes',
        content: 'Double-click on any highlighted cell reference to enter edit mode and change the reference.',
        position: 'left',
        blockSpreadsheet: true,
        graphHighlight: {
            nodeTypes: [],
            nodeSelector: '.cell-ref',
            mode: 'pulse',
        },
        awaitDoubleClick: '.cell-ref',
    },
    {
        id: 'choose-new-address',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Select new address',
        content: 'Now you can select a new address by selecting it directly in the spreadsheet.',
        position: 'left',
    },
    {
        id: 'commit-edit-01',
        targetSelector: '[data-tutorial="flow-graph"]',
        title: 'Apply edit',
        content: 'To apply the edit you can click on the check symbol or cancel the edit by clicking on the cancel button.',
        position: 'left',
        graphHighlight: {
            nodeTypes: [],
            nodeSelector: '.edit-actions',
            mode: 'pulse',
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
