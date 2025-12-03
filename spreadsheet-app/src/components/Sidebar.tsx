import { ReactFlow, Background, Controls, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ASTNode } from '../parser';
import { toGraph, resetNodeIdCounter, visitCollapsedNode } from '../parser/astToReactFlow';
import { useMemo, useRef } from 'react';
import { applyDagreLayout } from '../parser/dagreLayout';
import { collapseNode } from '../parser/collapseAST';

export interface SidebarProps {
  ast?: ASTNode;
}

const initialNodes = [
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

const initialEdges = [
  {
    id: 'n1-n2',
    source: 'n1',
    target: 'n2',
    type: 'step',
    label: 'connects with',
  },
];

export default function Sidebar({ast} : SidebarProps) {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const {nodes, edges} = useMemo(() => {
    if (ast === undefined) {
      return {nodes: initialNodes, edges: initialEdges};
    }
    resetNodeIdCounter();
    const collapsedTree = collapseNode(ast);
    const G = toGraph(collapsedTree, visitCollapsedNode);
    const layoutedG = applyDagreLayout(G)
    const nodes = layoutedG.nodes;
    const edges = layoutedG.edges;
    if (nodes.length === 0) {
      return {nodes: initialNodes, edges: initialEdges};
    } else {
      return {nodes, edges};
    }
  }, [ast]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ReactFlow nodes={nodes} edges={edges}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}