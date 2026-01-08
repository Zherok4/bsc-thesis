import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type Edge, type Node, type NodeChange, type NodeDimensionChange, useReactFlow, ReactFlowProvider, addEdge, type OnConnect, type Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './nodes/nodes.css';
import './Sidebar.css';
import type { ASTNode, FormulaNode } from '../parser';
import { transformAST, serializeNode, findAndSerializeNode, findAstNodeType, createCellReferenceTransformer, createNumberLiteralTransformer, createStringLiteralTransformer, createCellRangeTransformer, createColumnRangeTransformer, createRowRangeTransformer, parseFormula, createExpressionReplacementTransformer } from '../parser';
import { toGraphWithExpansion, resetNodeIdCounter, type ExpansionContext, type MergeConfig, createDefaultEdge, type UserEdgeData, validateConnection, getSourceNodeFormula, getTargetAstNodeId, getSourceCell } from '../parser/astToReactFlow';
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
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  /** Stores user-created edge metadata (survives graph rebuilds) */
  const userEdgeDataRef = useRef<Map<string, UserEdgeData>>(new Map());

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
      onNodeEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);

      // Only update syncedAst if editing the synced cell (not an expanded cell)
      if (!edit.sourceCell) {
        setSyncedAst(currentAst);
      }
      // Note: For expanded cells, the graph will rebuild on next render and
      // getCellFormulaAsCollapsedNode will fetch the updated formula from HyperFormula
    }

    exitEditMode();
  }, [onNodeEdit, exitEditMode, syncedAst, syncedCell, hfInstance]);

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
      console.log('[onConnect] Validation result:', validation);
      if (!validation.isValid) {
        console.warn('Invalid connection:', validation.errorMessage);
        return;
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
        console.log('[onConnect] New formula:', newFormula, 'Calling onNodeEdit...');
        onNodeEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);

        // Update syncedAst if editing the synced cell (not an expanded cell)
        if (!sourceCell) {
          setSyncedAst(result.ast);
        }
      } else {
        console.log('[onConnect] Transform not applied. transformed:', result.transformed, 'onNodeEdit:', !!onNodeEdit);
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
    [nodes, syncedAst, syncedCell, hfInstance, onNodeEdit, setEdges]
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
    return targetHandle.startsWith('arghandle-') || targetHandle === 'operand';
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
          console.log('[onEdgesDelete] Replaced with', replacementValue, ', new formula:', newFormula);
          onNodeEdit(newFormula, targetCell.row, targetCell.col, targetCell.sheet);

          // Update syncedAst if we modified the synced cell
          if (isForSyncedCell) {
            setSyncedAst(result.ast);
          }

          // Clean up any stored user data for this connection
          const stableKey = `${targetCell.sheet}-${targetCell.row}-${targetCell.col}-${targetHandle}`;
          userEdgeDataRef.current.delete(stableKey);
        } else {
          console.warn('[onEdgesDelete] Could not transform AST');
        }
      }
    },
    [nodes, syncedCell, syncedAst, hfInstance, onNodeEdit, getReplacementValue, isValidDeletionHandle]
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
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            isValidConnection={isValidConnection}
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