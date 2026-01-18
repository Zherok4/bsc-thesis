import { useState, useCallback, useEffect, type MutableRefObject } from 'react';
import type { ASTNode, FormulaNode } from '../../../parser';
import { serializeNode, parseFormula } from '../../../parser';
import type { HyperFormula, ExportedChange } from 'hyperformula';
import type { FormulaHistoryState } from '../../../hooks';
import type { CellPosition } from './useEdgeConnections';
import { createLogger } from '../../../utils/logger';

const log = createLogger('useSyncedGraph');

/**
 * Parameters for the useSyncedGraph hook
 */
export interface UseSyncedGraphParams {
    /** The incoming AST from the selected cell */
    ast: ASTNode | undefined;
    /** HyperFormula instance for formula evaluation */
    hfInstance: HyperFormula;
    /** Name of the active spreadsheet sheet */
    activeSheetName: string;
    /** Currently selected cell in the spreadsheet */
    selectedCell: { row: number; col: number } | null;
    /** Formula history for undo/redo */
    formulaHistory: FormulaHistoryState;
    /** Callback to set viewed cell highlight in spreadsheet */
    setViewedCellHighlight: (row: number, col: number, sheet: string) => void;
    /** Callback to clear viewed cell highlight */
    clearViewedCellHighlight: () => void;
    /** Callback to reset expanded nodes when syncing */
    resetExpandedNodes: () => void;
    /** Ref to trigger fit view after sync */
    fitViewOnNextRenderRef: MutableRefObject<boolean>;
}

/**
 * Return type for the useSyncedGraph hook
 */
export interface UseSyncedGraphReturn {
    /** The AST currently displayed in the graph */
    syncedAst: ASTNode | undefined;
    /** Setter for syncedAst (used by formula editing) */
    setSyncedAst: (ast: ASTNode | undefined) => void;
    /** The cell position currently displayed in the graph */
    syncedCell: CellPosition | null;
    /** Whether there is a pending sync (incoming ast differs from synced) */
    hasPendingSync: boolean;
    /** Sync the graph to the current cell's AST */
    handleSync: () => void;
    /** Counter that increments when values change, triggers graph rebuild */
    valuesVersion: number;
}

/**
 * Hook to manage the synced graph state.
 * Handles AST synchronization, HyperFormula value subscriptions,
 * and auto-sync when the synced cell's formula changes externally.
 */
export function useSyncedGraph({
    ast,
    hfInstance,
    activeSheetName,
    selectedCell,
    formulaHistory,
    setViewedCellHighlight,
    clearViewedCellHighlight,
    resetExpandedNodes,
    fitViewOnNextRenderRef,
}: UseSyncedGraphParams): UseSyncedGraphReturn {
    /** The AST that is currently synced/displayed in the graph */
    const [syncedAst, setSyncedAst] = useState<ASTNode | undefined>(ast);

    /** The cell position that is currently synced/displayed in the graph */
    const [syncedCell, setSyncedCell] = useState<CellPosition | null>(
        selectedCell ? { row: selectedCell.row, col: selectedCell.col, sheet: activeSheetName } : null
    );

    /** Whether there is a pending sync (incoming ast differs from synced ast) */
    const hasPendingSync = ast !== syncedAst;

    /** Counter that increments when synced cell's dependencies change, triggers graph rebuild */
    const [valuesVersion, setValuesVersion] = useState(0);

    /**
     * Subscribe to HyperFormula value changes and update graph when any cell changes.
     * We trigger on all changes because expanded nodes can show data from any
     * referenced cell, and those cells have their own transitive dependencies.
     */
    useEffect(() => {
        if (!syncedCell) return;

        const handler = (_changes: ExportedChange[]): void => {
            // Trigger rebuild on any value change since expanded nodes can show
            // data from any cell in the dependency tree
            setValuesVersion(v => v + 1);
        };

        hfInstance.on('valuesUpdated', handler);

        return () => {
            hfInstance.off('valuesUpdated', handler);
        };
    }, [hfInstance, syncedCell]);

    /**
     * Auto-sync the graph when the synced cell's formula is edited
     * (via Handsontable or FormulaBar). Queries HyperFormula directly
     * to handle cases where selection changes before AST updates.
     */
    useEffect(() => {
        if (!syncedCell) return;

        const sheetId = hfInstance.getSheetId(syncedCell.sheet);
        if (sheetId === undefined) return;

        const currentFormula = hfInstance.getCellFormula({
            sheet: sheetId,
            row: syncedCell.row,
            col: syncedCell.col,
        });

        log.debug(`Auto-sync check - syncedCell: ${JSON.stringify(syncedCell)}, formula: ${currentFormula}`);

        if (!currentFormula) {
            // Cell no longer has a formula, clear the synced AST
            log.warn(`No formula found for synced cell - clearing syncedAst: ${JSON.stringify(syncedCell)}`);
            if (syncedAst !== undefined) {
                setSyncedAst(undefined);
            }
            return;
        }

        try {
            const currentAst = parseFormula(currentFormula);
            const currentSerialized = serializeNode(currentAst);
            const syncedSerialized = syncedAst ? serializeNode(syncedAst as FormulaNode) : '';

            if (currentSerialized !== syncedSerialized) {
                setSyncedAst(currentAst);
            }
        } catch {
            // Parsing failed, ignore
        }
    }, [syncedCell, hfInstance, syncedAst, ast, selectedCell]);

    /** Sync the graph to the current cell's AST */
    const handleSync = useCallback(() => {
        // Clear history when syncing to a new cell
        formulaHistory.clear();

        setSyncedAst(ast);
        if (selectedCell) {
            const newSyncedCell = { row: selectedCell.row, col: selectedCell.col, sheet: activeSheetName };
            setSyncedCell(newSyncedCell);
            setViewedCellHighlight(newSyncedCell.row, newSyncedCell.col, newSyncedCell.sheet);

            // Capture initial formula for undo
            const sheetId = hfInstance.getSheetId(activeSheetName);
            if (sheetId !== undefined) {
                const initialFormula = hfInstance.getCellFormula({ sheet: sheetId, row: selectedCell.row, col: selectedCell.col });
                if (initialFormula) {
                    formulaHistory.push(initialFormula, selectedCell.row, selectedCell.col, activeSheetName);
                }
            }
        } else {
            setSyncedCell(null);
            clearViewedCellHighlight();
        }
        resetExpandedNodes();
        fitViewOnNextRenderRef.current = true;
    }, [ast, selectedCell, activeSheetName, setViewedCellHighlight, clearViewedCellHighlight, formulaHistory, hfInstance, resetExpandedNodes, fitViewOnNextRenderRef]);

    return {
        syncedAst,
        setSyncedAst,
        syncedCell,
        hasPendingSync,
        handleSync,
        valuesVersion,
    };
}
