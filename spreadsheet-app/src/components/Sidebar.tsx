import { ReactFlow, Background, Controls, type ReactFlowInstance, useNodesState, useEdgesState, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ASTNode } from '../parser';
import { toGraphWithExpansion, resetNodeIdCounter, type ExpansionContext } from '../parser/astToReactFlow';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { applyDagreLayout } from '../parser/dagreLayout';
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

export default function Sidebar({ ast, hfInstance, activeSheetName }: SidebarProps) {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

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

  // Build graph when collapsed tree or expansion state changes
  useEffect(() => {
    if (collapsedTree === null) {
      setNodes([]);
      setEdges([]);
    } else {
      resetNodeIdCounter();
      const context: ExpansionContext = {
        expandedNodeIds,
        onToggleExpand: handleToggleExpand,
      };
      const G = toGraphWithExpansion(collapsedTree, context);
      const layoutedG = applyDagreLayout(G);
      setNodes(layoutedG.nodes);
      setEdges(layoutedG.edges);
    }
  }, [collapsedTree, expandedNodeIds, handleToggleExpand, setNodes, setEdges]);

  // Reset expanded nodes when AST changes
  useEffect(() => {
    setExpandedNodeIds(new Set());
  }, [ast]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <HyperFormulaProvider hfInstance={hfInstance} activeSheetName={activeSheetName}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}>
          <Background />
          <Controls />
        </ReactFlow>
      </HyperFormulaProvider>
    </div>
  );
}