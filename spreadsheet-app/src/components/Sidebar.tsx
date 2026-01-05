import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type Edge, type Node, type NodeChange, type NodeDimensionChange, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './nodes/nodes.css';
import './Sidebar.css';
import type { ASTNode, FormulaNode } from '../parser';
import { transformAST, serializeNode, createCellReferenceTransformer, createNumberLiteralTransformer, createStringLiteralTransformer, createCellRangeTransformer, createColumnRangeTransformer, createRowRangeTransformer } from '../parser';
import { toGraphWithExpansion, resetNodeIdCounter, type ExpansionContext, type MergeConfig } from '../parser/astToReactFlow';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { applyDagreLayout, type NodeDimensionsMap } from '../parser/dagreLayout';
import { collapseNode, type CollapsedNode } from '../parser/collapseAST';
import TwoTextNodeComponent from './nodes/TwoTextNode';
import { HyperFormulaProvider, GraphEditModeContext, type NodeEdit, type SelectedRange } from './context';
import type { HyperFormula } from 'hyperformula';
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

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

  /** Saves an edit to a node and exits edit mode */
  const saveEdit = useCallback((edit: NodeEdit) => {
    if (!onNodeEdit || !syncedAst || !syncedCell) {
      exitEditMode();
      return;
    }

    let transformer;

    switch (edit.type) {
      case 'reference': {
        // Pass undefined for sheet if same sheet, so no sheet prefix is added to the AST
        const isSameSheet = edit.sheet === syncedCell.sheet;
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
        const isSameSheet = edit.sheet === syncedCell.sheet;
        const newSheet = isSameSheet ? undefined : edit.sheet;
        transformer = createCellRangeTransformer(edit.startReference, edit.endReference, newSheet);
        break;
      }
      case 'columnRange': {
        const isSameSheet = edit.sheet === syncedCell.sheet;
        const newSheet = isSameSheet ? undefined : edit.sheet;
        transformer = createColumnRangeTransformer(edit.startColumn, edit.endColumn, newSheet);
        break;
      }
      case 'rowRange': {
        const isSameSheet = edit.sheet === syncedCell.sheet;
        const newSheet = isSameSheet ? undefined : edit.sheet;
        transformer = createRowRangeTransformer(edit.startRow, edit.endRow, newSheet);
        break;
      }
    }

    // Apply transformation to all AST nodes (supports merged nodes with multiple astNodeIds)
    let currentAst = syncedAst as FormulaNode;
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
      onNodeEdit(newFormula, syncedCell.row, syncedCell.col, syncedCell.sheet);
      // Update the synced AST so the graph rebuilds with the new formula
      setSyncedAst(currentAst);
    }

    exitEditMode();
  }, [onNodeEdit, exitEditMode, syncedAst, syncedCell]);

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
    setSyncedAst(ast);
    if (selectedCell) {
      const newSyncedCell = { row: selectedCell.row, col: selectedCell.col, sheet: activeSheetName };
      setSyncedCell(newSyncedCell);
      setViewedCellHighlight(newSyncedCell.row, newSyncedCell.col, newSyncedCell.sheet);
    } else {
      setSyncedCell(null);
      clearViewedCellHighlight();
    }
    setExpandedNodeIds(new Set());
    fitViewOnNextRenderRef.current = true;
  }, [ast, selectedCell, activeSheetName, setViewedCellHighlight, clearViewedCellHighlight]);

  const collapsedTree = useMemo<CollapsedNode | null>(() => {
    if (syncedAst === undefined) return null;
    return collapseNode(syncedAst);
  }, [syncedAst]);

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

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
  }, [collapsedTree, buildGraph, setNodes, setEdges, fitView]);

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
      if (e.key === 'Escape' && isEditModeActive) {
        exitEditMode();
        if (selectedCell !== null) {
          scrollToCell(selectedCell.row, selectedCell.col, activeSheetName)
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModeActive, exitEditMode]);

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
            nodesDraggable={false}
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
            />
          </ReactFlow>
        </HyperFormulaProvider>
      </GraphEditModeContext.Provider>
    </div>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <ReactFlowProvider>
      <SidebarInner {...props} />
    </ReactFlowProvider>
  );
}