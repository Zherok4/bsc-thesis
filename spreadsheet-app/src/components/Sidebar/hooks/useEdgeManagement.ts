import { useCallback, useRef } from 'react';
import type { Edge, EdgeChange, EdgeMouseHandler, Node } from '@xyflow/react';
import type { ASTNode, FormulaNode } from '../../../parser';
import {
    transformAST,
    serializeNode,
    findAstNodeType,
    parseFormula,
    createExpressionReplacementTransformer,
} from '../../../parser';
import { getTargetAstNodeId, getSourceCell, type UserEdgeData } from '../../../parser/astToReactFlow';
import type { HyperFormula } from 'hyperformula';
import type { CellPosition } from './useEdgeConnections';
import type { ToastType } from '../../context';
import type { FormulaHistoryState } from '../../../hooks';
import { createLogger } from '../../../utils/logger';

const log = createLogger('useEdgeManagement');

/**
 * Parameters for the useEdgeManagement hook
 */
export interface UseEdgeManagementParams {
    nodes: Node[];
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    onEdgesChange: (changes: EdgeChange[]) => void;
    syncedAst: ASTNode | undefined;
    setSyncedAst: (ast: ASTNode | undefined) => void;
    syncedCell: CellPosition | null;
    hfInstance: HyperFormula;
    onNodeEdit?: (formula: string, row: number, col: number, sheet: string) => void;
    showToast: (message: string, type: ToastType) => void;
    applyFormulaEdit: (formula: string, row: number, col: number, sheet: string) => void;
    formulaHistory: FormulaHistoryState;
    isEditModeActive: boolean;
    enterEditMode: (nodeId?: string) => void;
    exitEditMode: () => void;
    userEdgeDataRef: React.MutableRefObject<Map<string, UserEdgeData>>;
}

/**
 * Return type for the useEdgeManagement hook
 */
export interface UseEdgeManagementReturn {
    onEdgeClick: EdgeMouseHandler;
    onEdgeDoubleClick: EdgeMouseHandler;
    handleEdgesChange: (changes: EdgeChange[]) => void;
    onEdgesDelete: (edges: Edge[]) => void;
}

/**
 * Hook to manage edge interactions: click, double-click, selection, and deletion.
 * Handles edge selection filtering and AST transformations for edge deletion.
 */
export function useEdgeManagement({
    nodes,
    setEdges,
    onEdgesChange,
    syncedAst,
    setSyncedAst,
    syncedCell,
    hfInstance,
    onNodeEdit,
    showToast,
    applyFormulaEdit,
    formulaHistory,
    isEditModeActive,
    enterEditMode,
    exitEditMode,
    userEdgeDataRef,
}: UseEdgeManagementParams): UseEdgeManagementReturn {
    /** Tracks whether edge selection should be allowed (double-click or single-click when in edit mode) */
    const allowEdgeSelectionRef = useRef(false);

    /**
     * Handles edge click - allows selection when already in edit mode.
     * When not in edit mode, does nothing (use double-click to enter edit mode).
     */
    const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
        if (isEditModeActive) {
            // Allow selection when already in edit mode
            allowEdgeSelectionRef.current = true;
            setEdges((eds) =>
                eds.map((e) => ({
                    ...e,
                    selected: e.id === edge.id,
                }))
            );
        }
        // When not in edit mode, do nothing - require double-click to enter edit mode
    }, [isEditModeActive, setEdges]);

    /**
     * Enables edge selection and edit mode on double-click.
     */
    const onEdgeDoubleClick: EdgeMouseHandler = useCallback((_event, edge) => {
        // Enter edit mode
        if (!isEditModeActive) {
            enterEditMode();
        }
        // Allow the selection change to go through
        allowEdgeSelectionRef.current = true;
        // Select this edge
        setEdges((eds) =>
            eds.map((e) => ({
                ...e,
                selected: e.id === edge.id,
            }))
        );
    }, [isEditModeActive, enterEditMode, setEdges]);

    /**
     * Wraps onEdgesChange to filter out edge selection changes unless explicitly allowed.
     * This ensures edges can only be selected via double-click or single-click when in edit mode.
     */
    const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
        const filteredChanges = changes.filter((change) => {
            // Block selection changes unless explicitly allowed (via double-click or edit mode click)
            if (change.type === 'select' && !allowEdgeSelectionRef.current) {
                return false;
            }
            return true;
        });
        // Reset the flag after processing
        allowEdgeSelectionRef.current = false;
        onEdgesChange(filteredChanges);
    }, [onEdgesChange]);

    /**
     * Determines the replacement value based on the AST node type being replaced.
     * StringLiteral -> "", all others -> 0
     */
    const getReplacementValue = useCallback((ast: FormulaNode, astNodeId: string): string => {
        const nodeType = findAstNodeType(ast, astNodeId);
        if (nodeType === 'StringLiteral') {
            return '""';
        }
        return '0';
    }, []);

    /**
     * Checks if a handle is a valid deletion target (argument handle or operand handle).
     */
    const isValidDeletionHandle = useCallback((targetHandle: string): boolean => {
        return targetHandle.startsWith('arghandle-') ||
            targetHandle === 'operand' ||
            targetHandle === 'left-operand' ||
            targetHandle === 'right-operand';
    }, []);

    /**
     * Handles edge deletion - replaces the argument with an appropriate constant.
     * Works for edges connected to argument handles (arghandle-*) or operand handles.
     * Replacement value is based on source node type: numbers -> 0, strings -> ""
     */
    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            // Debug: Check synced cell formula at start of edge deletion
            if (syncedCell) {
                const sheetId = hfInstance.getSheetId(syncedCell.sheet);
                if (sheetId !== undefined) {
                    const syncedFormula = hfInstance.getCellFormula({
                        sheet: sheetId,
                        row: syncedCell.row,
                        col: syncedCell.col,
                    });
                    log.debug(`Edge deletion started - syncedCell: ${JSON.stringify(syncedCell)}, formula: ${syncedFormula}`);
                }
            }

            for (const edge of deletedEdges) {
                const targetHandle = edge.targetHandle ?? '';
                log.debug(`Processing edge: ${edge.id}, handle: ${targetHandle}`);

                // Only process edges connected to valid handles
                if (!isValidDeletionHandle(targetHandle)) {
                    log.debug(`Skipping - not a valid deletion handle: ${targetHandle}`);
                    continue;
                }

                // Find the target node
                const targetNode = nodes.find(n => n.id === edge.target);

                if (!targetNode) {
                    log.warn(`Target node not found: ${edge.target}`);
                    continue;
                }

                // Get the cell info from the node (expanded nodes have sourceCell, root uses syncedCell)
                const nodeSourceCell = getSourceCell(targetNode);
                const targetCell = nodeSourceCell ?? syncedCell;
                const isForSyncedCell = !nodeSourceCell;

                log.debug(`Cell info retrieved - nodeSourceCell: ${JSON.stringify(nodeSourceCell)}`);

                if (!targetCell) {
                    log.warn('No target cell available');
                    continue;
                }

                log.debug(`Target cell: ${JSON.stringify(targetCell)}, isForSyncedCell: ${isForSyncedCell}`);

                // Get the current AST node ID using the handle
                const currentAstNodeId = getTargetAstNodeId(targetNode, targetHandle);
                if (!currentAstNodeId) {
                    log.warn(`Could not get AST node ID for handle: ${targetHandle}`);
                    continue;
                }

                log.debug(`AST node ID: ${currentAstNodeId}`);

                // Get the AST - use syncedAst for synced cell, fetch from HyperFormula for expanded cells
                let currentAst: FormulaNode | undefined;
                let originalFormula: string | undefined;

                if (isForSyncedCell) {
                    // Use the already-parsed syncedAst for the synced cell
                    currentAst = syncedAst as FormulaNode | undefined;
                    log.debug('Using syncedAst');
                } else {
                    // Fetch from HyperFormula for expanded cells
                    const sheetId = hfInstance.getSheetId(targetCell.sheet);
                    if (sheetId === undefined) {
                        log.warn(`Could not find sheet: ${targetCell.sheet}`);
                        continue;
                    }

                    const currentFormula = hfInstance.getCellFormula({
                        sheet: sheetId,
                        row: targetCell.row,
                        col: targetCell.col,
                    });

                    if (!currentFormula) {
                        log.warn('No formula found in cell');
                        continue;
                    }

                    // Store original formula for undo support
                    originalFormula = currentFormula;
                    log.debug(`Current formula from HyperFormula: ${currentFormula}`);

                    try {
                        currentAst = parseFormula(currentFormula);
                    } catch (e) {
                        log.warn(`Could not parse current formula: ${e}`);
                        continue;
                    }
                }

                if (!currentAst) {
                    log.warn('No AST available');
                    continue;
                }

                // Determine replacement value based on AST node type being replaced
                const replacementValue = getReplacementValue(currentAst, currentAstNodeId);
                log.debug(`Replacement value: ${replacementValue}, AST node type: ${findAstNodeType(currentAst, currentAstNodeId)}`);

                // Create transformer to replace with the appropriate constant
                const transformer = createExpressionReplacementTransformer(replacementValue);
                const result = transformAST(currentAst, currentAstNodeId, transformer);

                if (result.transformed && onNodeEdit) {
                    const newFormula = serializeNode(result.ast);
                    log.debug(`Applying formula: ${newFormula} to cell: ${JSON.stringify(targetCell)}`);

                    // Push original formula to history first for expanded cells (undo support)
                    if (!isForSyncedCell && originalFormula) {
                        formulaHistory.push(originalFormula, targetCell.row, targetCell.col, targetCell.sheet);
                    }

                    applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
                    showToast('Edge deleted', 'success');

                    // Update syncedAst if we modified the synced cell
                    if (isForSyncedCell) {
                        setSyncedAst(result.ast);
                    }

                    // Clean up any stored user data for this connection
                    const stableKey = `${targetCell.sheet}-${targetCell.row}-${targetCell.col}-${targetHandle}`;
                    userEdgeDataRef.current.delete(stableKey);

                    // Exit edit mode after a short delay to allow Handsontable to finish updating
                    // This prevents React re-renders from interfering with the spreadsheet update
                    setTimeout(() => {
                        exitEditMode();
                    }, 10);
                } else {
                    showToast('Could not delete edge', 'error');
                }
            }
        },
        [nodes, syncedCell, syncedAst, hfInstance, onNodeEdit, getReplacementValue, isValidDeletionHandle, showToast, applyFormulaEdit, formulaHistory, setSyncedAst, userEdgeDataRef, exitEditMode]
    );

    return {
        onEdgeClick,
        onEdgeDoubleClick,
        handleEdgesChange,
        onEdgesDelete,
    };
}
