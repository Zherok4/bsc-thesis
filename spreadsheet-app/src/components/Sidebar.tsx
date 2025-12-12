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

export interface SidebarProps {
  ast?: ASTNode;
  hfInstance: HyperFormula;
  activeSheetName: string;
}

const nodeTypes = {
  twoTextNode: TwoTextNodeComponent,
  ReferenceNode: ReferenceNodeComponent,
  RangeNode: RangeNodeComponent,
  NumberNode: NumberNodeComponent,
  StringNode: StringNodeComponent,
  FunctionNode: FunctionNodeComponent,
  ExpandableExpressionNode: ExpandableExpressionNodeComponent,
  ResultNode: ResultNodeComponent,
};

const initialNodes: Node[] = [
  {
    id: 'n1',
    position: { x: 0, y: 0 },
    data: { label: 'Node 1' },
    type: 'input',
  },
  {
    id: 'n2',
    position: { x: 100, y: 100 },
    data: { label: 'Node 2' },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'n1-n2',
    source: 'n1',
    target: 'n2',
    type: 'step',
    label: 'connects with',
  },
];

function SidebarInner({ ast, hfInstance, activeSheetName }: SidebarProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Track measured node dimensions for accurate layout
  const [measuredDimensions, setMeasuredDimensions] = useState<NodeDimensionsMap>(new Map());
  const [needsRelayout, setNeedsRelayout] = useState(false);
  const layoutGenerationRef = useRef(0);
  // Track if we should fitView (only on initial AST load, not on expansion changes)
  const shouldFitViewRef = useRef(false);

  // Memoize the collapsed tree so it doesn't recompute on expansion changes
  const collapsedTree = useMemo<CollapsedNode | null>(() => {
    if (ast === undefined) return null;
    return collapseNode(ast);
  }, [ast]);

  // Toggle expansion handler
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

  // Handle node changes, capturing dimension measurements
  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    // Apply default changes first
    onNodesChange(changes);

    // Check for dimension changes
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

          // Only update if dimensions actually changed (avoid unnecessary re-layouts)
          if (!existing ||
            Math.abs(existing.width - newDims.width) > 1 ||
            Math.abs(existing.height - newDims.height) > 1) {
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

  // Build graph when collapsed tree or expansion state changes
  useEffect(() => {
    if (collapsedTree === null) {
      setNodes([]);
      setEdges([]);
      setMeasuredDimensions(new Map());
    } else {
      layoutGenerationRef.current += 1;
      resetNodeIdCounter();
      const context: ExpansionContext = {
        expandedNodeIds,
        onToggleExpand: handleToggleExpand,
        hfInstance,
        activeSheetName,
      };
      const G = toGraphWithExpansion(collapsedTree, context);
      // Initial layout with estimated dimensions
      const layoutedG = applyDagreLayout(G);
      setNodes(layoutedG.nodes);
      setEdges(layoutedG.edges);
      // Clear measured dimensions for new graph
      setMeasuredDimensions(new Map());
      setNeedsRelayout(false);
      // Fit view only on initial graph build (when AST changes), not on expansion changes
      if (shouldFitViewRef.current) {
        setTimeout(() => fitView({ padding: 0.1 }), 0);
      }
    }
  }, [collapsedTree, expandedNodeIds, handleToggleExpand, hfInstance, activeSheetName, setNodes, setEdges, fitView]);

  // Re-layout with measured dimensions when needed
  useEffect(() => {
    if (!needsRelayout || measuredDimensions.size === 0) {
      return;
    }

    // Check if we have measurements for all (or most) nodes
    const measurementCoverage = measuredDimensions.size / nodes.length;

    // Only re-layout if we have measurements for at least 80% of nodes
    if (measurementCoverage < 0.8) {
      return;
    }

    // Capture current layout generation to detect stale updates
    const currentGeneration = layoutGenerationRef.current;

    // Debounce the re-layout to batch dimension changes
    const timeoutId = setTimeout(() => {
      // Check if layout generation changed (new graph was built)
      if (layoutGenerationRef.current !== currentGeneration) {
        return;
      }

      // Rebuild the graph structure (needed for fresh node references)
      if (collapsedTree === null) return;

      resetNodeIdCounter();
      const context: ExpansionContext = {
        expandedNodeIds,
        onToggleExpand: handleToggleExpand,
        hfInstance,
        activeSheetName,
      };
      const G = toGraphWithExpansion(collapsedTree, context);

      // Re-layout with measured dimensions
      const layoutedG = applyDagreLayout(G, measuredDimensions);
      setNodes(layoutedG.nodes);
      setEdges(layoutedG.edges);
      setNeedsRelayout(false);
      // Fit view only on initial graph build (when AST changes), not on expansion changes
      if (shouldFitViewRef.current) {
        setTimeout(() => fitView({ padding: 0.1 }), 0);
        shouldFitViewRef.current = false;
      }
    }, 50); // 50ms debounce

    return () => clearTimeout(timeoutId);
  }, [needsRelayout, measuredDimensions, nodes.length, collapsedTree, expandedNodeIds, handleToggleExpand, hfInstance, activeSheetName, setNodes, setEdges, fitView]);

  // Reset expanded nodes when AST changes and mark for fitView
  useEffect(() => {
    setExpandedNodeIds(new Set());
    shouldFitViewRef.current = true;
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