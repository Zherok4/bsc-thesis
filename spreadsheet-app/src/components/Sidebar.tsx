import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type Edge, type EdgeChange, type Node, type NodeChange, type NodeDimensionChange, useReactFlow, ReactFlowProvider, addEdge, type OnConnect, type Connection, type OnConnectStart, type OnConnectEnd, type EdgeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './nodes/nodes.css';
import './Sidebar.css';
import type { ASTNode, FormulaNode } from '../parser';
import { transformAST, serializeNode, findAndSerializeNode, findAstNodeType, createCellReferenceTransformer, createNumberLiteralTransformer, createStringLiteralTransformer, createCellRangeTransformer, createColumnRangeTransformer, createRowRangeTransformer, parseFormula, createExpressionReplacementTransformer, addFunctionArgument, swapExpressions } from '../parser';
import { toGraphWithExpansion, resetNodeIdCounter, type ExpansionContext, type MergeConfig, createDefaultEdge, type UserEdgeData, validateConnection, getSourceNodeFormula, getTargetAstNodeId, getSourceCell, getTargetHandlesForNode } from '../parser/astToReactFlow';
import { useEffect, useRef, useState, useCallback, useMemo, type JSX } from 'react';
import { applyDagreLayout, type NodeDimensionsMap } from '../parser/dagreLayout';
import { collapseNode, type CollapsedNode } from '../parser/collapseAST';
import TwoTextNodeComponent from './nodes/TwoTextNode';
import { HyperFormulaProvider, GraphEditModeContext, type NodeEdit, type SelectedRange, ToastProvider, useToast, ConnectionDragProvider, useConnectionDrag } from './context';
import ToastContainer from './Toast';
import { useFormulaHistory } from './hooks';
import type { HyperFormula, ExportedChange } from 'hyperformula';
import ReferenceNodeComponent from './nodes/ReferenceNode';
import RangeNodeComponent from './nodes/RangeNode';
import NumberNodeComponent from './nodes/NumberNode';
import StringNodeComponent from './nodes/StringNode';
import FunctionNodeComponent from './nodes/FunctionNode';
import ExpandableExpressionNodeComponent from './nodes/ExpandableExpressionNode';
import ResultNodeComponent from './nodes/ResultNode';
import BinOpNodeComponent from './nodes/BinOpNode';
import ConditionalNodeComponent from './nodes/ConditionalNode';
import GraphToolbar from './GraphToolbar';
import { ConnectionDropPopover } from './ConnectionDropPopover';

/**
 * State for a pending swap/replace connection when dropping on an occupied handle
 */
interface PendingSwapConnection {
  /** The new connection being made */
  connection: Connection;
  /** The existing edge that occupies the target handle */
  existingEdge: Edge;
}

/**
 * Props for the Sidebar component that renders an AST as a ReactFlow graph.
 */
export interface SidebarProps {
  /** The AST to visualize. When undefined, the graph is cleared. */
  ast?: ASTNode;
  /** HyperFormula instance for formula evaluation */
  hfInstance: HyperFormula;
  /** Name of the active spreadsheet sheet */
  activeSheetName: string;
  /** Address of the currently selected cell */
  selectedCell: {row: number, col: number} | null;
  /** Currently selected range in the spreadsheet (for range editing) */
  selectedRange: SelectedRange | null;
  /** scrollToCell Calback to move viewport to corresponding cell */
  scrollToCell: (row: number, col: number, sheet?: string) => void;
  highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
  clearHighlight: () => void;
  /** Set the viewed cell highlight (dotted border) in the spreadsheet */
  setViewedCellHighlight: (row: number, col: number, sheet: string) => void;
  /** Clear the viewed cell highlight */
  clearViewedCellHighlight: () => void;
  /** Callback when a node edit is saved. Receives the new formula and cell position to update. */
  onNodeEdit?: (newFormula: string, row: number, col: number, sheet: string) => void;
}

const MEASUREMENT_COVERAGE_THRESHOLD = 0.8;
const LAYOUT_DEBOUNCE_MS = 50;
const FIT_VIEW_PADDING = 0.1;
const DIMENSION_CHANGE_THRESHOLD = 1;

const hasDimensionChanged = (
  existing: { width: number; height: number } | undefined,
  newDims: { width: number; height: number }
) => !existing ||
  Math.abs(existing.width - newDims.width) > DIMENSION_CHANGE_THRESHOLD ||
  Math.abs(existing.height - newDims.height) > DIMENSION_CHANGE_THRESHOLD;

const nodeTypes = {
  TwoTextNode: TwoTextNodeComponent,
  ReferenceNode: ReferenceNodeComponent,
  RangeNode: RangeNodeComponent,
  NumberNode: NumberNodeComponent,
  StringNode: StringNodeComponent,
  FunctionNode: FunctionNodeComponent,
  ExpandableExpressionNode: ExpandableExpressionNodeComponent,
  ResultNode: ResultNodeComponent,
  BinOpNode: BinOpNodeComponent,
  ConditionalNode: ConditionalNodeComponent,
};

function SidebarInner({ ast, hfInstance, activeSheetName, selectedCell, selectedRange, scrollToCell, highlightCells, clearHighlight, setViewedCellHighlight, clearViewedCellHighlight, onNodeEdit }: SidebarProps) {
  const { fitView } = useReactFlow();
  const { showToast } = useToast();
  const formulaHistory = useFormulaHistory();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  /** Stores user-created edge metadata (survives graph rebuilds) */
  const userEdgeDataRef = useRef<Map<string, UserEdgeData>>(new Map());

  /** Tracks whether edge selection should be allowed (double-click or single-click when in edit mode) */
  const allowEdgeSelectionRef = useRef(false);

  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  const [isEditModeActive, setEditModeInternal] = useState<boolean>(false);
  const [editingNodeId, setEditingNodeIdInternal] = useState<string | null>(null);
  /** Reference key that is temporarily unmerged for individual editing */
  const [editingUnmergedRefKey, setEditingUnmergedRefKey] = useState<string | null>(null);

  /** Enters edit mode, optionally targeting a specific node */
  const enterEditMode = useCallback((nodeId?: string) => {
    setEditModeInternal(true);
    setEditingNodeIdInternal(nodeId ?? null);
  }, []);

  /** Exits edit mode and clears the editing node */
  const exitEditMode = useCallback(() => {
    setEditModeInternal(false);
    setEditingNodeIdInternal(null);
    setEditingUnmergedRefKey(null); // Re-merge on exit
  }, []);

  /** Unmerges a merged node temporarily for individual editing */
  const handleUnmerge = useCallback((refKey: string) => {
    setEditingUnmergedRefKey(refKey);
    setEditingNodeIdInternal(null); // Clear current node selection, user will pick one
  }, []);

  const [measuredDimensions, setMeasuredDimensions] = useState<NodeDimensionsMap>(new Map());
  const [needsRelayout, setNeedsRelayout] = useState(false);
  const layoutVersionRef = useRef(0);
  const fitViewOnNextRenderRef = useRef(false);

  /** The AST that is currently synced/displayed in the graph */
  const [syncedAst, setSyncedAst] = useState<ASTNode | undefined>(ast);
  /** The cell position that is currently synced/displayed in the graph */
  const [syncedCell, setSyncedCell] = useState<{row: number, col: number, sheet: string} | null>(
    selectedCell ? { row: selectedCell.row, col: selectedCell.col, sheet: activeSheetName } : null
  );

  /** Whether there is a pending sync (incoming ast differs from synced ast) */
  const hasPendingSync = ast !== syncedAst;

  /** Counter that increments when synced cell's dependencies change, triggers graph rebuild */
  const [valuesVersion, setValuesVersion] = useState(0);

  /** Pending connection when user drops on an occupied handle - shows Replace/Swap popover */
  const [pendingSwap, setPendingSwap] = useState<PendingSwapConnection | null>(null);

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

    if (!currentFormula) {
      // Cell no longer has a formula, clear the synced AST
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
  }, [onNodeEdit, exitEditMode, syncedAst, syncedCell, hfInstance, formulaHistory]);

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
  }, [formulaHistory, onNodeEdit, showToast, syncedCell]);

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
  }, [formulaHistory, onNodeEdit, showToast, syncedCell]);

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
    setExpandedNodeIds(new Set());
    fitViewOnNextRenderRef.current = true;
  }, [ast, selectedCell, activeSheetName, setViewedCellHighlight, clearViewedCellHighlight, formulaHistory, hfInstance]);

  const collapsedTree = useMemo<CollapsedNode | null>(() => {
    if (syncedAst === undefined) return null;
    return collapseNode(syncedAst);
  }, [syncedAst]);

  const handleToggleExpand = useCallback((nodeId: string) => {
    // Don't allow expansion changes in edit mode to prevent stale state
    // (graph rebuilds are blocked in edit mode, so expansion wouldn't be visible anyway)
    if (isEditModeActive) return;

    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, [isEditModeActive]);

  /** Configuration for merging duplicate reference nodes */
  const mergeConfig: MergeConfig = useMemo(() => ({
    enabled: true,
    maxDistance: 5,
  }), []);

  const buildGraph = useCallback((tree: CollapsedNode, dimensions?: NodeDimensionsMap) => {
    resetNodeIdCounter();
    /** The graphSheetName is the Sheet where Graph resides */
    const graphSheetName = syncedCell?.sheet || activeSheetName;

    const context: ExpansionContext = {
      expandedNodeIds,
      onToggleExpand: handleToggleExpand,
      hfInstance,
      activeSheetName: graphSheetName,
      isEditModeActive,
      enterEditMode,
      skipMergeForRefKey: editingUnmergedRefKey ?? undefined,
      onUnmerge: handleUnmerge,
    };

    const graph = toGraphWithExpansion(tree, context, mergeConfig);
    return applyDagreLayout(graph, dimensions);
  }, [expandedNodeIds, handleToggleExpand, hfInstance, mergeConfig, syncedCell?.sheet, editingUnmergedRefKey, handleUnmerge]);

  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    
    onNodesChange(changes);

    const dimensionChanges = changes.filter(
      (change): change is NodeDimensionChange =>
        change.type === 'dimensions' &&
        change.dimensions !== undefined
    );

    if (dimensionChanges.length > 0) {
      setMeasuredDimensions(prev => {
        const next = new Map(prev);
        let hasChanges = false;

        for (const change of dimensionChanges) {
          const existing = next.get(change.id);
          const newDims = change.dimensions!;

          if (hasDimensionChanged(existing, newDims)) {
            next.set(change.id, { width: newDims.width, height: newDims.height });
            hasChanges = true;
          }
        }

        if (hasChanges) {
          setNeedsRelayout(true);
        }

        return hasChanges ? next : prev;
      });
    }
  }, [onNodesChange]);

  /**
   * Handles new edge connections created by the user.
   * Modifies the underlying formula by replacing the target argument with the source node's value.
   */
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      console.log('[onConnect] Connection:', connection);
      if (!connection.source || !connection.target) return;

      // 1. Get source and target nodes
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);
      console.log('[onConnect] Source node:', sourceNode?.type, sourceNode?.data);
      console.log('[onConnect] Target node:', targetNode?.type, targetNode?.data);

      if (!sourceNode || !targetNode) return;

      // 2. Validate the connection
      const validation = validateConnection(
        sourceNode,
        targetNode,
        connection.targetHandle ?? null
      );
      if (!validation.isValid) {
        showToast(validation.errorMessage ?? 'Invalid connection', 'error');
        return;
      }

      // 2.5. Check if the target handle is already occupied
      const existingEdge = edges.find(
        e => e.target === connection.target && e.targetHandle === connection.targetHandle
      );

      if (existingEdge) {
        // Show popover with Replace/Swap options
        setPendingSwap({
          connection,
          existingEdge,
        });
        return; // Don't apply connection yet - wait for user choice
      }

      // 3. Get target AST node ID
      const targetAstNodeId = getTargetAstNodeId(
        targetNode,
        connection.targetHandle ?? null
      );
      console.log('[onConnect] Target AST node ID:', targetAstNodeId);
      if (!targetAstNodeId) {
        console.warn('Could not determine target AST node');
        // Still add the visual edge even if we can't modify the formula
        const edge = createDefaultEdge(connection.source, connection.target, connection.targetHandle ?? undefined);
        setEdges((currentEdges) => addEdge(edge, currentEdges));
        return;
      }

      // 4. Determine source cell (for expanded nodes) and target cell
      const sourceCell = getSourceCell(targetNode);
      const targetCell = sourceCell ?? syncedCell;
      console.log('[onConnect] Source cell:', sourceCell, 'Target cell:', targetCell);

      if (!targetCell) {
        console.warn('No target cell available');
        return;
      }

      // 5. Get source formula representation
      const sourceFormula = getSourceNodeFormula(sourceNode, targetCell.sheet);
      console.log('[onConnect] Source formula:', sourceFormula);
      if (!sourceFormula) {
        console.warn('Could not get formula from source node');
        return;
      }

      // 6. Get the target AST
      let targetAst: FormulaNode | undefined;
      if (sourceCell) {
        // Expanded node: parse from HyperFormula
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

      // 7. Capture the original expression before transforming (for undo on edge delete)
      const originalExpression = findAndSerializeNode(targetAst, targetAstNodeId);
      console.log('[onConnect] Original expression:', originalExpression);

      // 8. Create transformer and apply
      const transformer = createExpressionReplacementTransformer(sourceFormula);
      const result = transformAST(targetAst, targetAstNodeId, transformer);
      console.log('[onConnect] Transform result:', result.transformed, 'New AST:', result.ast);

      if (result.transformed && onNodeEdit) {
        const newFormula = serializeNode(result.ast);
        applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
        showToast('Connection created', 'success');

        // Update syncedAst if editing the synced cell (not an expanded cell)
        if (!sourceCell) {
          setSyncedAst(result.ast);
        }
      }

      // 9. Add visual edge and store user data with stable key (survives graph rebuilds)
      const edge = createDefaultEdge(connection.source, connection.target, connection.targetHandle ?? undefined);

      if (originalExpression && connection.targetHandle) {
        // Use stable key based on cell location + handle (not node IDs which change on rebuild)
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
    [nodes, edges, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit]
  );

  /**
   * Validates connections during drag to provide visual feedback.
   * Returns true if the connection would be valid.
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

  // Connection drag context for smart handle highlighting
  const connectionDrag = useConnectionDrag();

  /**
   * Computes all valid target handles for a given source node.
   * Used for smart highlighting during edge drag.
   */
  const computeValidTargetHandles = useCallback((sourceNode: Node | undefined): Set<string> => {
    const validHandles = new Set<string>();
    if (!sourceNode) return validHandles;

    for (const targetNode of nodes) {
      // Skip self-connections
      if (targetNode.id === sourceNode.id) continue;

      // Get all potential handles for this target node
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
   * Called when user starts dragging an edge from a source handle.
   * Pre-computes valid target handles for smart highlighting.
   * Auto-enters edit mode for consistent UX with node editing.
   */
  const onConnectStart: OnConnectStart = useCallback(
    (_, params) => {
      if (!params.nodeId) return;

      // Auto-enter edit mode when starting to drag an edge
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
   * Handles dropping a connection onto a variadic function's drop zone.
   * Creates a new argument and establishes the connection.
   */
  const handleVariadicDrop = useCallback(
    (sourceNodeId: string, targetNodeId: string, functionAstNodeId: string) => {
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      const targetNode = nodes.find(n => n.id === targetNodeId);

      if (!sourceNode || !targetNode) return;

      // Get the cell info from the target node (expanded nodes have sourceCell, root uses syncedCell)
      const nodeSourceCell = getSourceCell(targetNode);
      const targetCell = nodeSourceCell ?? syncedCell;

      if (!targetCell) {
        console.warn('[handleVariadicDrop] No target cell available');
        return;
      }

      // Get source formula representation
      const sourceFormula = getSourceNodeFormula(sourceNode, targetCell.sheet);
      if (!sourceFormula) {
        console.warn('[handleVariadicDrop] Could not get formula from source node');
        return;
      }

      // Get the target AST and original formula for undo
      let targetAst: FormulaNode | undefined;
      let originalFormula: string | undefined;
      if (nodeSourceCell) {
        // Expanded node: parse from HyperFormula
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

      // Add the new argument to the function
      const result = addFunctionArgument(targetAst, functionAstNodeId, sourceFormula);
      if (!result.success) {
        console.warn('[handleVariadicDrop] Failed to add argument');
        return;
      }

      // Apply the new formula with undo support
      if (onNodeEdit) {
        const newFormula = serializeNode(result.ast);

        // For expanded cells, capture original formula for undo before applying edit
        if (nodeSourceCell && originalFormula) {
          formulaHistory.push(originalFormula, targetCell.row, targetCell.col, targetCell.sheet);
        }

        applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
        showToast('Argument added', 'success');

        // Update syncedAst if editing the synced cell (not an expanded cell)
        if (!nodeSourceCell) {
          setSyncedAst(result.ast);
        }
      }

      // Create visual edge to the new handle
      const newHandleId = `arghandle-${result.newArgIndex}`;
      const edge = createDefaultEdge(sourceNodeId, targetNodeId, newHandleId);
      setEdges((currentEdges) => addEdge(edge, currentEdges));
    },
    [nodes, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit, formulaHistory]
  );

  /**
   * Called when user finishes dragging an edge (drop or cancel).
   * Detects drops on variadic function drop zones and handles them.
   */
  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      // Check if we dropped on a variadic drop zone
      const mouseEvent = event as MouseEvent;
      const element = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY);
      const dropZone = element?.closest('.variadic-drop-zone');

      // Use ref-based getter to avoid stale closure issues
      const sourceNodeId = connectionDrag.getSourceNodeId();

      if (dropZone && sourceNodeId) {
        // Find the target node by traversing up to the React Flow node wrapper
        const nodeElement = dropZone.closest('.react-flow__node');
        const targetNodeId = nodeElement?.getAttribute('data-id');

        // Get the function AST node ID from the wrapper
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
   * Replaces the existing connection's source with the new connection's source.
   */
  const handlePendingReplace = useCallback(() => {
    if (!pendingSwap) return;

    const { connection } = pendingSwap;

    // Find source and target nodes
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) {
      setPendingSwap(null);
      return;
    }

    // Get target AST node ID
    const targetAstNodeId = getTargetAstNodeId(targetNode, connection.targetHandle ?? null);
    if (!targetAstNodeId) {
      setPendingSwap(null);
      return;
    }

    // Get the target cell
    const sourceCell = getSourceCell(targetNode);
    const targetCell = sourceCell ?? syncedCell;
    if (!targetCell) {
      setPendingSwap(null);
      return;
    }

    // Get source formula representation
    const sourceFormula = getSourceNodeFormula(sourceNode, targetCell.sheet);
    if (!sourceFormula) {
      setPendingSwap(null);
      return;
    }

    // Get the target AST
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

    // Apply the replacement transformation
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

    // Add visual edge
    const edge = createDefaultEdge(connection.source, connection.target, connection.targetHandle ?? undefined);
    setEdges((currentEdges) => {
      // Remove the old edge first, then add the new one
      const filtered = currentEdges.filter(e => e.id !== pendingSwap.existingEdge.id);
      return addEdge(edge, filtered);
    });

    setPendingSwap(null);
    exitEditMode();
  }, [pendingSwap, nodes, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit, exitEditMode]);

  /**
   * Handles the "Swap" action from the pending swap popover.
   * Swaps the positions of the two connections.
   */
  const handlePendingSwap = useCallback(() => {
    if (!pendingSwap) return;

    const { connection, existingEdge } = pendingSwap;

    // Find source nodes for both connections
    const newSourceNode = nodes.find(n => n.id === connection.source);
    const existingSourceNode = nodes.find(n => n.id === existingEdge.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!newSourceNode || !existingSourceNode || !targetNode) {
      setPendingSwap(null);
      showToast('Could not find nodes for swap', 'error');
      return;
    }

    // Get the target cell
    const sourceCell = getSourceCell(targetNode);
    const targetCell = sourceCell ?? syncedCell;
    if (!targetCell) {
      setPendingSwap(null);
      return;
    }

    // Get the target AST node ID (where the existing edge is connected)
    const targetAstNodeId = getTargetAstNodeId(targetNode, connection.targetHandle ?? null);
    if (!targetAstNodeId) {
      setPendingSwap(null);
      showToast('Could not determine target position', 'error');
      return;
    }

    // Find where the new source is coming from (what handle it was connected to)
    const newSourcePreviousEdge = edges.find(e => e.source === connection.source && e.id !== existingEdge.id);

    if (!newSourcePreviousEdge) {
      // New source wasn't connected anywhere - can't swap, just do replace
      showToast('Source not connected - using replace instead', 'info');
      handlePendingReplace();
      return;
    }

    // Get the second target node (where newSource was previously connected)
    const secondTargetNode = nodes.find(n => n.id === newSourcePreviousEdge.target);
    if (!secondTargetNode) {
      setPendingSwap(null);
      showToast('Could not find second target node', 'error');
      return;
    }

    // Get the second AST node ID
    const secondAstNodeId = getTargetAstNodeId(secondTargetNode, newSourcePreviousEdge.targetHandle ?? null);
    if (!secondAstNodeId) {
      setPendingSwap(null);
      showToast('Could not determine second position', 'error');
      return;
    }

    // Get the target AST
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

    // Perform the swap in the AST
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

    // Update visual edges - swap the sources
    setEdges((currentEdges) => {
      return currentEdges.map(e => {
        if (e.id === existingEdge.id) {
          // The existing edge now points from newSource
          return { ...e, source: connection.source! };
        }
        if (e.id === newSourcePreviousEdge.id) {
          // The previous edge now points from existingSource
          return { ...e, source: existingEdge.source };
        }
        return e;
      });
    });

    setPendingSwap(null);
    exitEditMode();
  }, [pendingSwap, nodes, edges, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges, showToast, applyFormulaEdit, handlePendingReplace, exitEditMode]);

  /**
   * Cancels the pending swap/replace action.
   */
  const handlePendingCancel = useCallback(() => {
    setPendingSwap(null);
  }, []);

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
      for (const edge of deletedEdges) {
        const targetHandle = edge.targetHandle ?? '';
        console.log('[onEdgesDelete] Processing edge:', edge.id, 'targetHandle:', targetHandle);

        // Only process edges connected to valid handles
        if (!isValidDeletionHandle(targetHandle)) {
          console.log('[onEdgesDelete] Skipping - not a valid deletion handle');
          continue;
        }

        // Find the target node
        const targetNode = nodes.find(n => n.id === edge.target);

        if (!targetNode) {
          console.warn('[onEdgesDelete] Target node not found:', edge.target);
          continue;
        }

        // Get the cell info from the node (expanded nodes have sourceCell, root uses syncedCell)
        const nodeSourceCell = getSourceCell(targetNode);
        const targetCell = nodeSourceCell ?? syncedCell;
        const isForSyncedCell = !nodeSourceCell;

        if (!targetCell) {
          console.warn('[onEdgesDelete] No target cell available');
          continue;
        }

        console.log('[onEdgesDelete] Target cell:', targetCell, 'isForSyncedCell:', isForSyncedCell);

        // Get the current AST node ID using the handle
        const currentAstNodeId = getTargetAstNodeId(targetNode, targetHandle);
        if (!currentAstNodeId) {
          console.warn('[onEdgesDelete] Could not get AST node ID for handle:', targetHandle);
          continue;
        }

        console.log('[onEdgesDelete] AST node ID:', currentAstNodeId);

        // Get the AST - use syncedAst for synced cell, fetch from HyperFormula for expanded cells
        let currentAst: FormulaNode | undefined;

        if (isForSyncedCell) {
          // Use the already-parsed syncedAst for the synced cell
          currentAst = syncedAst as FormulaNode | undefined;
          console.log('[onEdgesDelete] Using syncedAst');
        } else {
          // Fetch from HyperFormula for expanded cells
          const sheetId = hfInstance.getSheetId(targetCell.sheet);
          if (sheetId === undefined) {
            console.warn('[onEdgesDelete] Could not find sheet:', targetCell.sheet);
            continue;
          }

          const currentFormula = hfInstance.getCellFormula({
            sheet: sheetId,
            row: targetCell.row,
            col: targetCell.col,
          });

          if (!currentFormula) {
            console.warn('[onEdgesDelete] No formula found in cell');
            continue;
          }

          console.log('[onEdgesDelete] Current formula from HF:', currentFormula);

          try {
            currentAst = parseFormula(currentFormula);
          } catch (e) {
            console.warn('[onEdgesDelete] Could not parse current formula:', e);
            continue;
          }
        }

        if (!currentAst) {
          console.warn('[onEdgesDelete] No AST available');
          continue;
        }

        // Determine replacement value based on AST node type being replaced
        const replacementValue = getReplacementValue(currentAst, currentAstNodeId);
        console.log('[onEdgesDelete] AST node type:', findAstNodeType(currentAst, currentAstNodeId), 'Replacement value:', replacementValue);

        // Create transformer to replace with the appropriate constant
        const transformer = createExpressionReplacementTransformer(replacementValue);
        const result = transformAST(currentAst, currentAstNodeId, transformer);

        if (result.transformed && onNodeEdit) {
          const newFormula = serializeNode(result.ast);
          applyFormulaEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);
          showToast('Edge deleted', 'success');

          // Update syncedAst if we modified the synced cell
          if (isForSyncedCell) {
            setSyncedAst(result.ast);
          }

          // Clean up any stored user data for this connection
          const stableKey = `${targetCell.sheet}-${targetCell.row}-${targetCell.col}-${targetHandle}`;
          userEdgeDataRef.current.delete(stableKey);
        } else {
          showToast('Could not delete edge', 'error');
        }
      }
    },
    [nodes, syncedCell, syncedAst, hfInstance, onNodeEdit, getReplacementValue, isValidDeletionHandle, showToast, applyFormulaEdit]
  );

  useEffect(() => {
    if (isEditModeActive) return;

    if (collapsedTree === null) {
      setNodes([]);
      setEdges([]);
      setMeasuredDimensions(new Map());
      return;
    }

    layoutVersionRef.current += 1;
    const layoutedGraph = buildGraph(collapsedTree);
    setNodes(layoutedGraph.nodes);
    setEdges(layoutedGraph.edges);
    setMeasuredDimensions(new Map());
    setNeedsRelayout(false);

    if (fitViewOnNextRenderRef.current) {
      setTimeout(() => fitView({ padding: FIT_VIEW_PADDING }), 0);
    }
  }, [collapsedTree, buildGraph, setNodes, setEdges, fitView, valuesVersion]);

  useEffect(() => {
    if (!needsRelayout || measuredDimensions.size === 0) {
      return;
    }

    const measurementCoverage = measuredDimensions.size / nodes.length;
    if (measurementCoverage < MEASUREMENT_COVERAGE_THRESHOLD) {
      return;
    }

    const currentGeneration = layoutVersionRef.current;

    const timeoutId = setTimeout(() => {
      if (layoutVersionRef.current !== currentGeneration) {
        return;
      }
      if (collapsedTree === null) return;

      const layoutedGraph = buildGraph(collapsedTree, measuredDimensions);
      setNodes(layoutedGraph.nodes);
      setEdges(layoutedGraph.edges);
      setNeedsRelayout(false);

      if (fitViewOnNextRenderRef.current) {
        setTimeout(() => fitView({ padding: FIT_VIEW_PADDING }), 0);
        fitViewOnNextRenderRef.current = false;
      }
    }, LAYOUT_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [needsRelayout, measuredDimensions, nodes.length, collapsedTree, buildGraph, setNodes, setEdges, fitView]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to exit edit mode
      if (e.key === 'Escape' && isEditModeActive) {
        exitEditMode();
        if (selectedCell !== null) {
          scrollToCell(selectedCell.row, selectedCell.col, activeSheetName)
        }
        return;
      }

      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y (or Cmd+Shift+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModeActive, exitEditMode, handleUndo, handleRedo, selectedCell, scrollToCell, activeSheetName]);

  return (
    <div className={`sidebar-inner ${isEditModeActive ? 'edit-mode-active' : 'preview-mode-active'}`}>
      <GraphEditModeContext.Provider
        value={{ isEditModeActive, editingNodeId, enterEditMode, exitEditMode, saveEdit, onUnmerge: handleUnmerge }}
      >
        <HyperFormulaProvider
          hfInstance={hfInstance}
          activeSheetName={activeSheetName}
          selectedCell={selectedCell}
          selectedRange={selectedRange}
          scrollToCell={scrollToCell}
          highlightCells={highlightCells}
          clearHighlight={clearHighlight}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onEdgesDelete={onEdgesDelete}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            isValidConnection={isValidConnection}
            nodesDraggable={true}
            zoomOnDoubleClick={false}
          >
            <Background />
            <Controls />
            <GraphToolbar
              currentCellAddress={currentCellAddress}
              currentCell={syncedCell}
              hasPendingSync={hasPendingSync}
              pendingCellAddress={pendingCellAddress}
              onSync={handleSync}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={formulaHistory.canUndo}
              canRedo={formulaHistory.canRedo}
            />
          </ReactFlow>
        </HyperFormulaProvider>
      </GraphEditModeContext.Provider>
      <ToastContainer />
      {pendingSwap && (
        <ConnectionDropPopover
          targetNodeId={pendingSwap.connection.target!}
          targetHandle={pendingSwap.connection.targetHandle!}
          onReplace={handlePendingReplace}
          onSwap={handlePendingSwap}
          onCancel={handlePendingCancel}
        />
      )}
    </div>
  );
}

export default function Sidebar(props: SidebarProps): JSX.Element {
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <ConnectionDragProvider>
          <SidebarInner {...props} />
        </ConnectionDragProvider>
      </ReactFlowProvider>
    </ToastProvider>
  );
}