import { useRef, useCallback, useMemo } from 'react';
import { useNodesState, useEdgesState, useReactFlow, type Edge, type Node } from '@xyflow/react';
import type { ASTNode } from '../../../parser';
import { toGraphWithExpansion, resetNodeIdCounter, type ExpansionContext, type MergeConfig } from '../../../parser/astToReactFlow';
import { applyDagreLayout, type NodeDimensionsMap } from '../../../parser/dagreLayout';
import { collapseNode, type CollapsedNode } from '../../../parser/collapseAST';
import { useFormulaHistory, useEditMode } from '../../../hooks';
import { useToast, useSpreadsheetActions, useConnectionDrag } from '../../context';
import type { SelectedRange } from '../../context';
import type { HyperFormula } from 'hyperformula';
import { useEdgeConnections } from './useEdgeConnections';
import { useEdgeManagement } from './useEdgeManagement';
import { useFormulaEditing } from './useFormulaEditing';
import { useSyncedGraph } from './useSyncedGraph';
import { useGraphLayout } from './useGraphLayout';
import { useNodeExpansion } from './useNodeExpansion';
import { useGraphKeyboardShortcuts } from './useGraphKeyboardShortcuts';

/**
 * Parameters for the useSidebarState hook.
 */
export interface UseSidebarStateParams {
  /** The AST to visualize */
  ast?: ASTNode;
  /** HyperFormula instance for formula evaluation */
  hfInstance: HyperFormula;
  /** Name of the active spreadsheet sheet */
  activeSheetName: string;
  /** Address of the currently selected cell */
  selectedCell: { row: number; col: number } | null;
  /** Currently selected range in the spreadsheet */
  selectedRange: SelectedRange | null;
  /** Callback to scroll viewport to a cell */
  scrollToCell: (row: number, col: number, sheet?: string) => void;
  /** Callback to highlight cells */
  highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
  /** Callback to clear cell highlighting */
  clearHighlight: () => void;
  /** Updates a cell's content via Handsontable (triggers proper rendering) */
  updateCell: (newValue: string | number, row: number, col: number, sheet?: string) => void;
  /** Version counter that increments when sheets are added/removed (triggers graph reset) */
  sheetsVersion: number;
}

/**
 * Return type for the useSidebarState hook.
 *
 * This composes all sidebar state and handlers into a single object,
 * documenting the dependencies between hooks.
 */
export interface UseSidebarStateReturn {
  // ReactFlow state
  nodes: Node[];
  edges: Edge[];

  // Edit mode state
  isEditModeActive: boolean;
  editingNodeId: string | null;
  enterEditMode: (nodeId?: string) => void;
  exitEditMode: () => void;
  saveEdit: ReturnType<typeof useFormulaEditing>['saveEdit'];
  handleUnmerge: ReturnType<typeof useEditMode>['handleUnmerge'];

  // Graph state
  syncedCell: ReturnType<typeof useSyncedGraph>['syncedCell'];
  hasPendingSync: boolean;
  handleSync: () => void;
  collapsedTree: CollapsedNode | null;

  // Formula history
  formulaHistory: ReturnType<typeof useFormulaHistory>;
  handleUndo: () => void;
  handleRedo: () => void;
  currentCellAddress: string | null;
  pendingCellAddress: string | null;

  // ReactFlow handlers
  handleNodesChange: ReturnType<typeof useGraphLayout>['handleNodesChange'];
  handleEdgesChange: ReturnType<typeof useEdgeManagement>['handleEdgesChange'];
  onConnect: ReturnType<typeof useEdgeConnections>['onConnect'];
  onConnectStart: ReturnType<typeof useEdgeConnections>['onConnectStart'];
  onConnectEnd: ReturnType<typeof useEdgeConnections>['onConnectEnd'];
  onEdgesDelete: ReturnType<typeof useEdgeManagement>['onEdgesDelete'];
  onEdgeClick: ReturnType<typeof useEdgeManagement>['onEdgeClick'];
  onEdgeDoubleClick: ReturnType<typeof useEdgeManagement>['onEdgeDoubleClick'];
  isValidConnection: ReturnType<typeof useEdgeConnections>['isValidConnection'];

  // Connection drop popover state
  pendingSwap: ReturnType<typeof useEdgeConnections>['pendingSwap'];
  handlePendingReplace: () => void;
  handlePendingSwap: () => void;
  handlePendingCancel: () => void;

  // Context values for providers
  selectedRange: SelectedRange | null;
  scrollToCell: (row: number, col: number, sheet?: string) => void;
  highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
  clearHighlight: () => void;
  updateCell: (newValue: string | number, row: number, col: number, sheet?: string) => void;
  hfInstance: HyperFormula;
  activeSheetName: string;
  selectedCell: { row: number; col: number } | null;
}

/**
 * Composes all sidebar state management hooks into a single hook.
 *
 * This hook manages the complex interdependencies between sidebar hooks:
 *
 * Hook dependency order:
 * 1. useFormulaHistory - No dependencies, provides undo/redo state
 * 2. useEditMode - No dependencies, provides edit state
 * 3. useNodeExpansion - Depends on isEditModeActive (blocks expansion during edit)
 * 4. useSyncedGraph - Depends on formulaHistory, resetExpansion
 * 5. useFormulaEditing - Depends on syncedGraph, formulaHistory, exitEditMode
 * 6. buildGraph (memoized) - Depends on expansion, edit mode, synced state
 * 7. useGraphLayout - Depends on nodes, collapsedTree, buildGraph
 * 8. useEdgeConnections - Depends on graph state, formula editing, edit mode
 * 9. useEdgeManagement - Depends on graph state, formula editing, edit mode
 * 10. useGraphKeyboardShortcuts - Depends on edit mode, formula actions
 *
 * @param params - Configuration for sidebar state
 * @returns Composed state and handlers for the sidebar component
 */
export function useSidebarState(params: UseSidebarStateParams): UseSidebarStateReturn {
  const {
    ast,
    hfInstance,
    activeSheetName,
    selectedCell,
    selectedRange,
    scrollToCell,
    highlightCells,
    clearHighlight,
    updateCell,
    sheetsVersion,
  } = params;

  // ReactFlow hooks
  const { fitView, setCenter, getZoom } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Context hooks
  const { showToast } = useToast();
  const { setViewedCellHighlight, clearViewedCellHighlight, onNodeEdit, deselectCell } = useSpreadsheetActions();
  const connectionDrag = useConnectionDrag();

  // Ref for triggering fitView on next render (shared between hooks)
  const fitViewOnNextRenderRef = useRef(false);

  // 1. Formula history - no dependencies
  const formulaHistory = useFormulaHistory();

  // 2. Edit mode - no dependencies
  const {
    isEditModeActive,
    editingNodeId,
    editingUnmergedRefKey,
    enterEditMode: enterEditModeInternal,
    exitEditMode,
    handleUnmerge,
  } = useEditMode();

  // Wrapper that deselects spreadsheet cells before entering edit mode
  const enterEditMode = useCallback((nodeId?: string) => {
    deselectCell();
    enterEditModeInternal(nodeId);
  }, [deselectCell, enterEditModeInternal]);

  // 3. Node expansion - depends on edit mode
  const {
    expandedNodeIds,
    handleToggleExpand,
    resetExpansion,
    pendingExpansionRef,
  } = useNodeExpansion({ isEditModeActive });

  // 4. Synced graph - depends on formulaHistory, resetExpansion
  const {
    syncedAst,
    setSyncedAst,
    syncedCell,
    hasPendingSync,
    handleSync,
    valuesVersion,
  } = useSyncedGraph({
    ast,
    hfInstance,
    activeSheetName,
    selectedCell,
    formulaHistory,
    setViewedCellHighlight,
    clearViewedCellHighlight,
    resetExpandedNodes: resetExpansion,
    fitViewOnNextRenderRef,
    sheetsVersion,
  });

  // 5. Formula editing - depends on syncedGraph, formulaHistory, exitEditMode
  const {
    saveEdit,
    applyFormulaEdit,
    handleUndo,
    handleRedo,
    currentCellAddress,
    pendingCellAddress,
  } = useFormulaEditing({
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
  });

  // Derived state: collapsed tree for graph building
  const collapsedTree = useMemo<CollapsedNode | null>(() => {
    if (syncedAst === undefined) return null;
    return collapseNode(syncedAst);
  }, [syncedAst]);

  // Configuration for merging duplicate reference nodes
  const mergeConfig: MergeConfig = useMemo(() => ({
    enabled: true,
    maxDistance: 5,
  }), []);

  // 6. Build graph function - depends on expansion, edit mode, synced state
  const buildGraph = useCallback((tree: CollapsedNode, dimensions?: NodeDimensionsMap) => {
    resetNodeIdCounter();
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
      syncedCell: syncedCell ?? undefined,
    };

    const graph = toGraphWithExpansion(tree, context, mergeConfig);
    return applyDagreLayout(graph, dimensions);
  }, [
    expandedNodeIds,
    handleToggleExpand,
    hfInstance,
    mergeConfig,
    syncedCell,
    isEditModeActive,
    enterEditMode,
    editingUnmergedRefKey,
    handleUnmerge,
    activeSheetName,
  ]);

  // 7. Graph layout - depends on nodes, collapsedTree, buildGraph
  const { handleNodesChange } = useGraphLayout({
    nodes,
    setNodes,
    setEdges,
    onNodesChange,
    collapsedTree,
    buildGraph,
    fitView,
    setCenter,
    getZoom,
    isEditModeActive,
    valuesVersion,
    fitViewOnNextRenderRef,
    pendingExpansionRef,
  });

  // 8. Edge connections - depends on graph state, formula editing, edit mode
  const {
    onConnect,
    onConnectStart,
    onConnectEnd,
    isValidConnection,
    pendingSwap,
    handlePendingReplace,
    handlePendingSwap,
    handlePendingCancel,
    userEdgeDataRef,
  } = useEdgeConnections({
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
  });

  // 9. Edge management - depends on graph state, formula editing, edit mode
  const {
    onEdgeClick,
    onEdgeDoubleClick,
    handleEdgesChange,
    onEdgesDelete,
  } = useEdgeManagement({
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
  });

  // 10. Keyboard shortcuts - depends on edit mode, formula actions
  useGraphKeyboardShortcuts({
    isEditModeActive,
    exitEditMode,
    handleUndo,
    handleRedo,
    selectedCell,
    scrollToCell,
    activeSheetName,
  });

  return {
    // ReactFlow state
    nodes,
    edges,

    // Edit mode state
    isEditModeActive,
    editingNodeId,
    enterEditMode,
    exitEditMode,
    saveEdit,
    handleUnmerge,

    // Graph state
    syncedCell,
    hasPendingSync,
    handleSync,
    collapsedTree,

    // Formula history
    formulaHistory,
    handleUndo,
    handleRedo,
    currentCellAddress,
    pendingCellAddress,

    // ReactFlow handlers
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onEdgesDelete,
    onEdgeClick,
    onEdgeDoubleClick,
    isValidConnection,

    // Connection drop popover state
    pendingSwap,
    handlePendingReplace,
    handlePendingSwap,
    handlePendingCancel,

    // Pass through for context providers
    selectedRange,
    scrollToCell,
    highlightCells,
    clearHighlight,
    updateCell,
    hfInstance,
    activeSheetName,
    selectedCell,
  };
}
