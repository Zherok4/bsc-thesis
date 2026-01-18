import { useCallback, useMemo } from 'react';
import type { ASTNode, FormulaNode } from '../../../parser';
import {
    transformAST,
    serializeNode,
    parseFormula,
    createCellReferenceTransformer,
    createNumberLiteralTransformer,
    createStringLiteralTransformer,
    createCellRangeTransformer,
    createColumnRangeTransformer,
    createRowRangeTransformer,
} from '../../../parser';
import type { HyperFormula } from 'hyperformula';
import type { NodeEdit, ToastType } from '../../context';
import type { FormulaHistoryState } from '../../../hooks';
import type { CellPosition } from './useEdgeConnections';

/**
 * Parameters for the useFormulaEditing hook
 */
export interface UseFormulaEditingParams {
    syncedAst: ASTNode | undefined;
    setSyncedAst: (ast: ASTNode | undefined) => void;
    syncedCell: CellPosition | null;
    hfInstance: HyperFormula;
    activeSheetName: string;
    selectedCell: { row: number; col: number } | null;
    ast: ASTNode | undefined;
    hasPendingSync: boolean;
    onNodeEdit?: (formula: string, row: number, col: number, sheet: string) => void;
    formulaHistory: FormulaHistoryState;
    exitEditMode: () => void;
    showToast: (message: string, type: ToastType) => void;
}

/**
 * Return type for the useFormulaEditing hook
 */
export interface UseFormulaEditingReturn {
    saveEdit: (edit: NodeEdit) => void;
    applyFormulaEdit: (formula: string, row: number, col: number, sheet: string) => void;
    handleUndo: () => void;
    handleRedo: () => void;
    currentCellAddress: string | null;
    pendingCellAddress: string | null;
}

/**
 * Hook to manage formula editing operations: save edits, undo/redo, and cell address computation.
 * Handles AST transformations for node edits and integrates with formula history.
 */
export function useFormulaEditing({
    syncedAst,
    setSyncedAst,
    syncedCell,
    hfInstance,
    activeSheetName,
    selectedCell,
    ast,
    hasPendingSync,
    onNodeEdit,
    formulaHistory,
    exitEditMode,
    showToast,
}: UseFormulaEditingParams): UseFormulaEditingReturn {
    /**
     * Saves an edit to a node and exits edit mode.
     * Handles both top-level edits (syncedCell) and expanded branch edits (sourceCell).
     */
    const saveEdit = useCallback((edit: NodeEdit) => {
        if (!onNodeEdit) {
            exitEditMode();
            return;
        }

        // Determine target cell: sourceCell for expanded nodes, syncedCell for top-level
        const targetCell = edit.sourceCell ?? syncedCell;

        if (!targetCell) {
            exitEditMode();
            return;
        }

        // Get the AST for the target cell
        let targetAst: FormulaNode | undefined;

        if (edit.sourceCell) {
            // Expanded node: fetch and parse the source cell's formula
            const sheetId = hfInstance.getSheetId(edit.sourceCell.sheet);
            if (sheetId === undefined) {
                exitEditMode();
                return;
            }
            const cellAddress = { sheet: sheetId, row: edit.sourceCell.row, col: edit.sourceCell.col };
            const formula = hfInstance.getCellFormula(cellAddress);
            if (!formula) {
                exitEditMode();
                return;
            }
            try {
                targetAst = parseFormula(formula);
            } catch {
                exitEditMode();
                return;
            }
        } else {
            // Top-level node: use syncedAst
            if (!syncedAst) {
                exitEditMode();
                return;
            }
            targetAst = syncedAst as FormulaNode;
        }

        if (!targetAst) {
            exitEditMode();
            return;
        }

        let transformer;

        switch (edit.type) {
            case 'reference': {
                // Pass undefined for sheet if same sheet, so no sheet prefix is added to the AST
                const isSameSheet = edit.sheet === targetCell.sheet;
                const newSheet = isSameSheet ? undefined : edit.sheet;
                transformer = createCellReferenceTransformer(edit.newValue, newSheet);
                break;
            }
            case 'number':
                transformer = createNumberLiteralTransformer(edit.newValue);
                break;
            case 'string':
                transformer = createStringLiteralTransformer(edit.newValue);
                break;
            case 'cellRange': {
                const isSameSheet = edit.sheet === targetCell.sheet;
                const newSheet = isSameSheet ? undefined : edit.sheet;
                transformer = createCellRangeTransformer(edit.startReference, edit.endReference, newSheet);
                break;
            }
            case 'columnRange': {
                const isSameSheet = edit.sheet === targetCell.sheet;
                const newSheet = isSameSheet ? undefined : edit.sheet;
                transformer = createColumnRangeTransformer(edit.startColumn, edit.endColumn, newSheet);
                break;
            }
            case 'rowRange': {
                const isSameSheet = edit.sheet === targetCell.sheet;
                const newSheet = isSameSheet ? undefined : edit.sheet;
                transformer = createRowRangeTransformer(edit.startRow, edit.endRow, newSheet);
                break;
            }
        }

        if (!transformer) {
            exitEditMode();
            return;
        }

        // Apply transformation to all AST nodes (supports merged nodes with multiple astNodeIds)
        let currentAst = targetAst;
        let anyTransformed = false;

        for (const astNodeId of edit.astNodeIds) {
            const result = transformAST(currentAst, astNodeId, transformer);
            if (result.transformed) {
                currentAst = result.ast;
                anyTransformed = true;
            }
        }

        if (anyTransformed) {
            const newFormula = serializeNode(currentAst);

            // Push to history for undo/redo
            formulaHistory.push(newFormula, targetCell.row, targetCell.col, targetCell.sheet);

            onNodeEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);

            // Only update syncedAst if editing the synced cell (not an expanded cell)
            if (!edit.sourceCell) {
                setSyncedAst(currentAst);
            }
            // Note: For expanded cells, the graph will rebuild on next render and
            // getCellFormulaAsCollapsedNode will fetch the updated formula from HyperFormula
        }

        exitEditMode();
    }, [onNodeEdit, exitEditMode, syncedAst, syncedCell, hfInstance, formulaHistory, setSyncedAst]);

    /**
     * Wrapper for onNodeEdit that also pushes to history for undo/redo.
     * Use this instead of calling onNodeEdit directly.
     */
    const applyFormulaEdit = useCallback((newFormula: string, row: number, col: number, sheet: string) => {
        if (!onNodeEdit) return;

        // Push the new state to history (the current state was already pushed by previous edit or initial capture)
        formulaHistory.push(newFormula, row, col, sheet);

        // Apply the edit
        onNodeEdit(newFormula, row, col, sheet);
    }, [onNodeEdit, formulaHistory]);

    /**
     * Handles undo action - restores previous formula state
     */
    const handleUndo = useCallback(() => {
        const entry = formulaHistory.undo();
        if (entry && onNodeEdit) {
            onNodeEdit(entry.formula, entry.cell.row, entry.cell.col, entry.cell.sheet);

            // Update syncedAst if this is for the synced cell so graph rebuilds
            if (syncedCell &&
                entry.cell.row === syncedCell.row &&
                entry.cell.col === syncedCell.col &&
                entry.cell.sheet === syncedCell.sheet) {
                try {
                    const newAst = parseFormula(entry.formula);
                    setSyncedAst(newAst);
                } catch {
                    // If parsing fails, just update via onNodeEdit
                }
            }

            showToast('Undo', 'info');
        }
    }, [formulaHistory, onNodeEdit, showToast, syncedCell, setSyncedAst]);

    /**
     * Handles redo action - restores next formula state
     */
    const handleRedo = useCallback(() => {
        const entry = formulaHistory.redo();
        if (entry && onNodeEdit) {
            onNodeEdit(entry.formula, entry.cell.row, entry.cell.col, entry.cell.sheet);

            // Update syncedAst if this is for the synced cell so graph rebuilds
            if (syncedCell &&
                entry.cell.row === syncedCell.row &&
                entry.cell.col === syncedCell.col &&
                entry.cell.sheet === syncedCell.sheet) {
                try {
                    const newAst = parseFormula(entry.formula);
                    setSyncedAst(newAst);
                } catch {
                    // If parsing fails, just update via onNodeEdit
                }
            }

            showToast('Redo', 'info');
        }
    }, [formulaHistory, onNodeEdit, showToast, syncedCell, setSyncedAst]);

    /** The cell address currently being viewed in the graph */
    const currentCellAddress = useMemo<string | null>(() => {
        if (!syncedCell) return null;
        const sheetId = hfInstance.getSheetId(syncedCell.sheet);
        if (sheetId === undefined) return null;
        const address = { sheet: sheetId, row: syncedCell.row, col: syncedCell.col };
        try {
            return hfInstance.simpleCellAddressToString(address, { includeSheetName: false }) ?? null;
        } catch {
            // Cell address out of bounds for this sheet
            return null;
        }
    }, [syncedCell, hfInstance]);

    /** The cell address to sync to, shown in the sync button (only if cell has a formula) */
    const pendingCellAddress = useMemo<string | null>(() => {
        if (!hasPendingSync || !selectedCell || !ast) return null;
        const sheetId = hfInstance.getSheetId(activeSheetName);
        if (sheetId === undefined) return null;
        const address = { sheet: sheetId, row: selectedCell.row, col: selectedCell.col };
        try {
            return hfInstance.simpleCellAddressToString(address, { includeSheetName: false }) ?? null;
        } catch {
            // Cell address out of bounds for this sheet
            return null;
        }
    }, [hasPendingSync, selectedCell, ast, hfInstance, activeSheetName]);

    return {
        saveEdit,
        applyFormulaEdit,
        handleUndo,
        handleRedo,
        currentCellAddress,
        pendingCellAddress,
    };
}
