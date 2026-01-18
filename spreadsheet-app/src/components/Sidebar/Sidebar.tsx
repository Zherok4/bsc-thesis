import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type Edge, type Node, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../nodes/nodes.css';
import './Sidebar.css';
import type { ASTNode } from '../../parser';
import { toGraphWithExpansion, resetNodeIdCounter, type ExpansionContext, type MergeConfig } from '../../parser/astToReactFlow';
import { useRef, useCallback, useMemo, type JSX } from 'react';
import { applyDagreLayout, type NodeDimensionsMap } from '../../parser/dagreLayout';
import { collapseNode, type CollapsedNode } from '../../parser/collapseAST';
import TwoTextNodeComponent from '../nodes/TwoTextNode';
import { HyperFormulaProvider, GraphEditModeContext, type SelectedRange, ToastProvider, useToast, ConnectionDragProvider, useConnectionDrag } from '../context';
import ToastContainer from '../Toast';
import { useFormulaHistory, useEditMode } from '../../hooks';
import {
  useEdgeConnections,
  useEdgeManagement,
  useFormulaEditing,
  useSyncedGraph,
  useGraphLayout,
  useNodeExpansion,
  useGraphKeyboardShortcuts,
} from './hooks';
import type { HyperFormula } from 'hyperformula';
import ReferenceNodeComponent from '../nodes/ReferenceNode';
import RangeNodeComponent from '../nodes/RangeNode';
import NumberNodeComponent from '../nodes/NumberNode';
import StringNodeComponent from '../nodes/StringNode';
import FunctionNodeComponent from '../nodes/FunctionNode';
import ExpandableExpressionNodeComponent from '../nodes/ExpandableExpressionNode';
import ResultNodeComponent from '../nodes/ResultNode';
import BinOpNodeComponent from '../nodes/BinOpNode';
import ConditionalNodeComponent from '../nodes/ConditionalNode';
import GraphToolbar from '../GraphToolbar';
import { ConnectionDropPopover } from '../ConnectionDropPopover';

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

  // Ref for triggering fitView on next render (shared between hooks)
  const fitViewOnNextRenderRef = useRef(false);

  // Use the extracted edit mode hook
  const {
    isEditModeActive,
    editingNodeId,
    editingUnmergedRefKey,
    enterEditMode,
    exitEditMode,
    handleUnmerge,
  } = useEditMode();

  // Use the extracted node expansion hook
  const {
    expandedNodeIds,
    handleToggleExpand,
    resetExpansion,
  } = useNodeExpansion({ isEditModeActive });

  // Use the extracted synced graph hook
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
  });

  // Use the extracted formula editing hook
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

  const collapsedTree = useMemo<CollapsedNode | null>(() => {
    if (syncedAst === undefined) return null;
    return collapseNode(syncedAst);
  }, [syncedAst]);

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
  }, [expandedNodeIds, handleToggleExpand, hfInstance, mergeConfig, syncedCell?.sheet, isEditModeActive, enterEditMode, editingUnmergedRefKey, handleUnmerge, activeSheetName]);

  // Use the extracted graph layout hook
  const {
    handleNodesChange,
  } = useGraphLayout({
    nodes,
    setNodes,
    setEdges,
    onNodesChange,
    collapsedTree,
    buildGraph,
    fitView,
    isEditModeActive,
    valuesVersion,
    fitViewOnNextRenderRef,
  });

  // Connection drag context for smart handle highlighting
  const connectionDrag = useConnectionDrag();

  // Use the extracted edge connections hook
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

  // Use the extracted edge management hook
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
    isEditModeActive,
    enterEditMode,
    userEdgeDataRef,
  });

  // Use the extracted keyboard shortcuts hook
  useGraphKeyboardShortcuts({
    isEditModeActive,
    exitEditMode,
    handleUndo,
    handleRedo,
    selectedCell,
    scrollToCell,
    activeSheetName,
  });

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