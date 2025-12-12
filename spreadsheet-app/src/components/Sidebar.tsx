import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type Edge, type Node, type NodeChange, type NodeDimensionChange, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ASTNode } from '../parser';
import { toGraphWithExpansion, resetNodeIdCounter, type ExpansionContext } from '../parser/astToReactFlow';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { applyDagreLayout, type NodeDimensionsMap } from '../parser/dagreLayout';
import { collapseNode, type CollapsedNode } from '../parser/collapseAST';
import TwoTextNodeComponent from './nodes/TwoTextNode';
import { HyperFormulaProvider } from './context';
import type { HyperFormula } from 'hyperformula';
import ReferenceNodeComponent from './nodes/referenceNode';
import RangeNodeComponent from './nodes/rangeNode';
import NumberNodeComponent from './nodes/numberNode';
import StringNodeComponent from './nodes/stringNode';
import FunctionNodeComponent from './nodes/functionNode';
import ExpandableExpressionNodeComponent from './nodes/ExpandableExpressionNode';
import ResultNodeComponent from './nodes/resultNode';

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
};

function SidebarInner({ ast, hfInstance, activeSheetName }: SidebarProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  const [measuredDimensions, setMeasuredDimensions] = useState<NodeDimensionsMap>(new Map());
  const [needsRelayout, setNeedsRelayout] = useState(false);
  const layoutVersionRef = useRef(0);
  const fitViewOnNextRenderRef = useRef(false);

  const collapsedTree = useMemo<CollapsedNode | null>(() => {
    if (ast === undefined) return null;
    return collapseNode(ast);
  }, [ast]);

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

  const buildGraph = useCallback((tree: CollapsedNode, dimensions?: NodeDimensionsMap) => {
    resetNodeIdCounter();
    const context: ExpansionContext = {
      expandedNodeIds,
      onToggleExpand: handleToggleExpand,
      hfInstance,
      activeSheetName,
    };
    const graph = toGraphWithExpansion(tree, context);
    return applyDagreLayout(graph, dimensions);
  }, [expandedNodeIds, handleToggleExpand, hfInstance, activeSheetName]);

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
    setExpandedNodeIds(new Set());
    fitViewOnNextRenderRef.current = true;
  }, [ast]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <HyperFormulaProvider hfInstance={hfInstance} activeSheetName={activeSheetName}>
        <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        nodesDraggable={false}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </HyperFormulaProvider>
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