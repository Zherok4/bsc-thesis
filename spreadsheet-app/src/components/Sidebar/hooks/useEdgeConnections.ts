import { useCallback, useRef, useState } from 'react';
import {
    type Edge,
    type Node,
    type OnConnect,
    type OnConnectStart,
    type OnConnectEnd,
    type Connection,
    addEdge,
} from '@xyflow/react';
import type { ASTNode, FormulaNode } from '../../../parser';
import {
    transformAST,
    serializeNode,
    findAndSerializeNode,
    parseFormula,
    createExpressionReplacementTransformer,
    addFunctionArgument,
    swapExpressions,
} from '../../../parser';
import {
    createDefaultEdge,
    type UserEdgeData,
    validateConnection,
    getSourceNodeFormula,
    getTargetAstNodeId,
    getSourceCell,
    getTargetHandlesForNode,
} from '../../../parser/astToReactFlow';
import type { HyperFormula } from 'hyperformula';
import type { ConnectionDragContextValue } from '../../context';
import type { FormulaHistoryState } from '../../../hooks';

/**
 * Cell position with sheet information
 */
export interface CellPosition {
    row: number;
    col: number;
    sheet: string;
}

/**
 * State for a pending swap/replace connection when dropping on an occupied handle
 */
export interface PendingSwapConnection {
    /** The new connection being made */
    connection: Connection;
    /** The existing edge that occupies the target handle */
    existingEdge: Edge;
}

/**
 * Parameters for the useEdgeConnections hook
 */
export interface UseEdgeConnectionsParams {
    /** Current graph nodes */
    nodes: Node[];
    /** Current graph edges */
    edges: Edge[];
    /** Setter for edges state */
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    /** Current synced AST */
    syncedAst: ASTNode | undefined;
    /** Setter for synced AST */
    setSyncedAst: (ast: ASTNode | undefined) => void;
    /** Current synced cell position */
    syncedCell: CellPosition | null;
    /** HyperFormula instance */
    hfInstance: HyperFormula;
    /** Callback when a node edit is saved */
    onNodeEdit?: (formula: string, row: number, col: number, sheet: string) => void;
    /** Show a toast notification */
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    /** Apply a formula edit with history tracking */
    applyFormulaEdit: (formula: string, row: number, col: number, sheet: string) => void;
    /** Formula history for undo/redo */
    formulaHistory: FormulaHistoryState;
    /** Connection drag context */
    connectionDrag: ConnectionDragContextValue;
    /** Whether edit mode is active */
    isEditModeActive: boolean;
    /** Enter edit mode */
    enterEditMode: (nodeId?: string) => void;
    /** Exit edit mode */
    exitEditMode: () => void;
}

/**
 * Return type for the useEdgeConnections hook
 */
export interface UseEdgeConnectionsReturn {
    /** Handler for new connections */
    onConnect: OnConnect;
    /** Handler for connection drag start */
    onConnectStart: OnConnectStart;
    /** Handler for connection drag end */
    onConnectEnd: OnConnectEnd;
    /** Validates if a connection is valid */
    isValidConnection: (connection: Edge | Connection) => boolean;
    /** Pending swap/replace connection state */
    pendingSwap: PendingSwapConnection | null;
    /** Handle replace action from popover */
    handlePendingReplace: () => void;
    /** Handle swap action from popover */
    handlePendingSwap: () => void;
    /** Handle cancel action from popover */
    handlePendingCancel: () => void;
    /** Ref for storing user-created edge metadata */
    userEdgeDataRef: React.MutableRefObject<Map<string, UserEdgeData>>;
}

/**
 * Hook to manage edge connection operations in the graph.
 * Handles creating, validating, and managing connections between nodes.
 */
export function useEdgeConnections({
    nodes,
    edges,
    setEdges,
    syncedAst,
    setSyncedAst,
    syncedCell,
    hfInstance,
    onNodeEdit,
    showToast,
    applyFormulaEdit,
    formulaHistory,
    connectionDrag,
    isEditModeActive,
    enterEditMode,
    exitEditMode,
}: UseEdgeConnectionsParams): UseEdgeConnectionsReturn {
    /** Stores user-created edge metadata (survives graph rebuilds) */
    const userEdgeDataRef = useRef<Map<string, UserEdgeData>>(new Map());

    /** Pending connection when user drops on an occupied handle */
    const [pendingSwap, setPendingSwap] = useState<PendingSwapConnection | null>(null);

    /**
     * Validates connections during drag to provide visual feedback.
     */
    const isValidConnection = useCallback(
        (connection: Edge | Connection): boolean => {
            if (!connection.source || !connection.target) return false;

            const sourceNode = nodes.find(n => n.id === connection.source);
            const targetNode = nodes.find(n => n.id === connection.target);

            if (!sourceNode || !targetNode) return false;

            const validation = validateConnection(
                sourceNode,
                targetNode,
                connection.targetHandle ?? null
            );

            return validation.isValid;
        },
        [nodes]
    );

    /**
     * Computes all valid target handles for a given source node.
     */
    const computeValidTargetHandles = useCallback((sourceNode: Node | undefined): Set<string> => {
        const validHandles = new Set<string>();
        if (!sourceNode) return validHandles;

        for (const targetNode of nodes) {
            if (targetNode.id === sourceNode.id) continue;

            const handles = getTargetHandlesForNode(targetNode);

            for (const handleId of handles) {
                const validation = validateConnection(sourceNode, targetNode, handleId);
                if (validation.isValid) {
                    validHandles.add(`${targetNode.id}:${handleId}`);
                }
            }
        }

        return validHandles;
    }, [nodes]);

    /**
     * Handles dropping a connection onto a variadic function's drop zone.
     */
    const handleVariadicDrop = useCallback(
        (sourceNodeId: string, targetNodeId: string, functionAstNodeId: string) => {
            const sourceNode = nodes.find(n => n.id === sourceNodeId);
            const targetNode = nodes.find(n => n.id === targetNodeId);

            if (!sourceNode || !targetNode) return;

            const nodeSourceCell = getSourceCell(targetNode);
            const targetCell = nodeSourceCell ?? syncedCell;

            if (!targetCell) {
                console.warn('[handleVariadicDrop] No target cell available');
                return;
            }

            const sourceFormula = getSourceNodeFormula(sourceNode, targetCell.sheet);
            if (!sourceFormula) {
                console.warn('[handleVariadicDrop] Could not get formula from source node');
                return;
            }

            let targetAst: FormulaNode | undefined;
            let originalFormula: string | undefined;
            if (nodeSourceCell) {
                const sheetId = hfInstance.getSheetId(nodeSourceCell.sheet);
                if (sheetId === undefined) return;
                const formula = hfInstance.getCellFormula({
                    sheet: sheetId,
                    row: nodeSourceCell.row,
                    col: nodeSourceCell.col
                });
                if (!formula) return;
                originalFormula = formula;
                try {
                    targetAst = parseFormula(formula);
                } catch {
                    return;
                }
            } else {
                targetAst = syncedAst as FormulaNode | undefined;
            }

            if (!targetAst) {
                console.warn('[handleVariadicDrop] No target AST available');
                return;
            }

            const result = addFunctionArgument(targetAst, functionAstNodeId, sourceFormula);
            if (!result.success) {
                console.warn('[handleVariadicDrop] Failed to add argument');
                return;
            }

            if (onNodeEdit) {
                const newFormula = serializeNode(result.ast);

                if (nodeSourceCell && originalFormula) {
                    formulaHistory.push(originalFormula, targetCell.row, targetCell.col, targetCell.sheet);
                }

                applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
                showToast('Argument added', 'success');

                if (!nodeSourceCell) {
                    setSyncedAst(result.ast);
                }
            }

            const newHandleId = `arghandle-${result.newArgIndex}`;
            const edge = createDefaultEdge(sourceNodeId, targetNodeId, newHandleId);
            setEdges((currentEdges) => addEdge(edge, currentEdges));
        },
        [nodes, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit, formulaHistory, setSyncedAst]
    );

    /**
     * Handles new edge connections created by the user.
     */
    const onConnect: OnConnect = useCallback(
        (connection: Connection) => {
            console.log('[onConnect] Connection:', connection);
            if (!connection.source || !connection.target) return;

            const sourceNode = nodes.find(n => n.id === connection.source);
            const targetNode = nodes.find(n => n.id === connection.target);
            console.log('[onConnect] Source node:', sourceNode?.type, sourceNode?.data);
            console.log('[onConnect] Target node:', targetNode?.type, targetNode?.data);

            if (!sourceNode || !targetNode) return;

            const validation = validateConnection(
                sourceNode,
                targetNode,
                connection.targetHandle ?? null
            );
            if (!validation.isValid) {
                showToast(validation.errorMessage ?? 'Invalid connection', 'error');
                return;
            }

            const existingEdge = edges.find(
                e => e.target === connection.target && e.targetHandle === connection.targetHandle
            );

            if (existingEdge) {
                setPendingSwap({
                    connection,
                    existingEdge,
                });
                return;
            }

            const targetAstNodeId = getTargetAstNodeId(
                targetNode,
                connection.targetHandle ?? null
            );
            console.log('[onConnect] Target AST node ID:', targetAstNodeId);
            if (!targetAstNodeId) {
                console.warn('Could not determine target AST node');
                const edge = createDefaultEdge(connection.source, connection.target, connection.targetHandle ?? undefined);
                setEdges((currentEdges) => addEdge(edge, currentEdges));
                return;
            }

            const sourceCell = getSourceCell(targetNode);
            const targetCell = sourceCell ?? syncedCell;
            console.log('[onConnect] Source cell:', sourceCell, 'Target cell:', targetCell);

            if (!targetCell) {
                console.warn('No target cell available');
                return;
            }

            const sourceFormula = getSourceNodeFormula(sourceNode, targetCell.sheet);
            console.log('[onConnect] Source formula:', sourceFormula);
            if (!sourceFormula) {
                console.warn('Could not get formula from source node');
                return;
            }

            let targetAst: FormulaNode | undefined;
            if (sourceCell) {
                const sheetId = hfInstance.getSheetId(sourceCell.sheet);
                if (sheetId === undefined) return;
                const formula = hfInstance.getCellFormula({
                    sheet: sheetId,
                    row: sourceCell.row,
                    col: sourceCell.col
                });
                if (!formula) return;
                try {
                    targetAst = parseFormula(formula);
                } catch {
                    return;
                }
            } else {
                targetAst = syncedAst as FormulaNode | undefined;
            }
            console.log('[onConnect] Target AST:', targetAst);

            if (!targetAst) {
                console.warn('No target AST available');
                return;
            }

            const originalExpression = findAndSerializeNode(targetAst, targetAstNodeId);
            console.log('[onConnect] Original expression:', originalExpression);

            const transformer = createExpressionReplacementTransformer(sourceFormula);
            const result = transformAST(targetAst, targetAstNodeId, transformer);
            console.log('[onConnect] Transform result:', result.transformed, 'New AST:', result.ast);

            if (result.transformed && onNodeEdit) {
                const newFormula = serializeNode(result.ast);
                applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
                showToast('Connection created', 'success');

                if (!sourceCell) {
                    setSyncedAst(result.ast);
                }
            }

            const edge = createDefaultEdge(connection.source, connection.target, connection.targetHandle ?? undefined);

            if (originalExpression && connection.targetHandle) {
                const stableKey = `${targetCell.sheet}-${targetCell.row}-${targetCell.col}-${connection.targetHandle}`;
                const userData: UserEdgeData = {
                    isUserCreated: true,
                    originalExpression,
                    targetHandle: connection.targetHandle,
                    targetCell: {
                        row: targetCell.row,
                        col: targetCell.col,
                        sheet: targetCell.sheet,
                    },
                };
                userEdgeDataRef.current.set(stableKey, userData);
                console.log('[onConnect] Stored edge data with stable key:', stableKey, userData);
            }

            setEdges((currentEdges) => addEdge(edge, currentEdges));
        },
        [nodes, edges, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit, setSyncedAst]
    );

    /**
     * Called when user starts dragging an edge from a source handle.
     */
    const onConnectStart: OnConnectStart = useCallback(
        (_, params) => {
            if (!params.nodeId) return;

            if (!isEditModeActive) {
                enterEditMode();
            }

            const sourceNode = nodes.find(n => n.id === params.nodeId);
            if (!sourceNode) return;

            const validHandles = computeValidTargetHandles(sourceNode);
            connectionDrag.startDrag(params.nodeId, sourceNode.type ?? '', validHandles);
        },
        [nodes, computeValidTargetHandles, connectionDrag, isEditModeActive, enterEditMode]
    );

    /**
     * Called when user finishes dragging an edge (drop or cancel).
     */
    const onConnectEnd: OnConnectEnd = useCallback(
        (event) => {
            const mouseEvent = event as MouseEvent;
            const element = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY);
            const dropZone = element?.closest('.variadic-drop-zone');

            const sourceNodeId = connectionDrag.getSourceNodeId();

            if (dropZone && sourceNodeId) {
                const nodeElement = dropZone.closest('.react-flow__node');
                const targetNodeId = nodeElement?.getAttribute('data-id');

                const nodeWrapper = dropZone.closest('.node-wrapper');
                const functionAstNodeId = nodeWrapper?.getAttribute('data-function-ast-node-id');

                if (targetNodeId && functionAstNodeId) {
                    handleVariadicDrop(sourceNodeId, targetNodeId, functionAstNodeId);
                }
            }

            connectionDrag.endDrag();
        },
        [connectionDrag, handleVariadicDrop]
    );

    /**
     * Handles the "Replace" action from the pending swap popover.
     */
    const handlePendingReplace = useCallback(() => {
        if (!pendingSwap) return;

        const { connection } = pendingSwap;

        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) {
            setPendingSwap(null);
            return;
        }

        const targetAstNodeId = getTargetAstNodeId(targetNode, connection.targetHandle ?? null);
        if (!targetAstNodeId) {
            setPendingSwap(null);
            return;
        }

        const sourceCell = getSourceCell(targetNode);
        const targetCell = sourceCell ?? syncedCell;
        if (!targetCell) {
            setPendingSwap(null);
            return;
        }

        const sourceFormula = getSourceNodeFormula(sourceNode, targetCell.sheet);
        if (!sourceFormula) {
            setPendingSwap(null);
            return;
        }

        let targetAst: FormulaNode | undefined;
        if (sourceCell) {
            const sheetId = hfInstance.getSheetId(sourceCell.sheet);
            if (sheetId === undefined) {
                setPendingSwap(null);
                return;
            }
            const formula = hfInstance.getCellFormula({
                sheet: sheetId,
                row: sourceCell.row,
                col: sourceCell.col
            });
            if (!formula) {
                setPendingSwap(null);
                return;
            }
            try {
                targetAst = parseFormula(formula);
            } catch {
                setPendingSwap(null);
                return;
            }
        } else {
            targetAst = syncedAst as FormulaNode | undefined;
        }

        if (!targetAst) {
            setPendingSwap(null);
            return;
        }

        const transformer = createExpressionReplacementTransformer(sourceFormula);
        const result = transformAST(targetAst, targetAstNodeId, transformer);

        if (result.transformed && onNodeEdit) {
            const newFormula = serializeNode(result.ast);
            applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
            showToast('Connection replaced', 'success');

            if (!sourceCell) {
                setSyncedAst(result.ast);
            }
        }

        const edge = createDefaultEdge(connection.source, connection.target, connection.targetHandle ?? undefined);
        setEdges((currentEdges) => {
            const filtered = currentEdges.filter(e => e.id !== pendingSwap.existingEdge.id);
            return addEdge(edge, filtered);
        });

        setPendingSwap(null);
        exitEditMode();
    }, [pendingSwap, nodes, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit, exitEditMode, setSyncedAst]);

    /**
     * Handles the "Swap" action from the pending swap popover.
     */
    const handlePendingSwap = useCallback(() => {
        if (!pendingSwap) return;

        const { connection, existingEdge } = pendingSwap;

        const newSourceNode = nodes.find(n => n.id === connection.source);
        const existingSourceNode = nodes.find(n => n.id === existingEdge.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (!newSourceNode || !existingSourceNode || !targetNode) {
            setPendingSwap(null);
            showToast('Could not find nodes for swap', 'error');
            return;
        }

        const sourceCell = getSourceCell(targetNode);
        const targetCell = sourceCell ?? syncedCell;
        if (!targetCell) {
            setPendingSwap(null);
            return;
        }

        const targetAstNodeId = getTargetAstNodeId(targetNode, connection.targetHandle ?? null);
        if (!targetAstNodeId) {
            setPendingSwap(null);
            showToast('Could not determine target position', 'error');
            return;
        }

        const newSourcePreviousEdge = edges.find(e => e.source === connection.source && e.id !== existingEdge.id);

        if (!newSourcePreviousEdge) {
            showToast('Source not connected - using replace instead', 'info');
            handlePendingReplace();
            return;
        }

        const secondTargetNode = nodes.find(n => n.id === newSourcePreviousEdge.target);
        if (!secondTargetNode) {
            setPendingSwap(null);
            showToast('Could not find second target node', 'error');
            return;
        }

        const secondAstNodeId = getTargetAstNodeId(secondTargetNode, newSourcePreviousEdge.targetHandle ?? null);
        if (!secondAstNodeId) {
            setPendingSwap(null);
            showToast('Could not determine second position', 'error');
            return;
        }

        let targetAst: FormulaNode | undefined;
        if (sourceCell) {
            const sheetId = hfInstance.getSheetId(sourceCell.sheet);
            if (sheetId === undefined) {
                setPendingSwap(null);
                return;
            }
            const formula = hfInstance.getCellFormula({
                sheet: sheetId,
                row: sourceCell.row,
                col: sourceCell.col
            });
            if (!formula) {
                setPendingSwap(null);
                return;
            }
            try {
                targetAst = parseFormula(formula);
            } catch {
                setPendingSwap(null);
                return;
            }
        } else {
            targetAst = syncedAst as FormulaNode | undefined;
        }

        if (!targetAst) {
            setPendingSwap(null);
            return;
        }

        const swapResult = swapExpressions(targetAst, targetAstNodeId, secondAstNodeId);

        if (!swapResult.swapped) {
            setPendingSwap(null);
            showToast('Could not swap expressions', 'error');
            return;
        }

        if (onNodeEdit) {
            const newFormula = serializeNode(swapResult.ast);
            applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
            showToast('Arguments swapped', 'success');

            if (!sourceCell) {
                setSyncedAst(swapResult.ast);
            }
        }

        setEdges((currentEdges) => {
            return currentEdges.map(e => {
                if (e.id === existingEdge.id) {
                    return { ...e, source: connection.source! };
                }
                if (e.id === newSourcePreviousEdge.id) {
                    return { ...e, source: existingEdge.source };
                }
                return e;
            });
        });

        setPendingSwap(null);
        exitEditMode();
    }, [pendingSwap, nodes, edges, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit, handlePendingReplace, exitEditMode, setSyncedAst]);

    /**
     * Cancels the pending swap/replace action.
     */
    const handlePendingCancel = useCallback(() => {
        setPendingSwap(null);
    }, []);

    return {
        onConnect,
        onConnectStart,
        onConnectEnd,
        isValidConnection,
        pendingSwap,
        handlePendingReplace,
        handlePendingSwap,
        handlePendingCancel,
        userEdgeDataRef,
    };
}
