import { ReactFlow, Background, Controls, type ReactFlowInstance, useNodesState, useEdgesState, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ASTNode } from '../parser';
import { toGraph, resetNodeIdCounter, visitCollapsedNode } from '../parser/astToReactFlow';
import { useEffect, useRef } from 'react';
import { applyDagreLayout } from '../parser/dagreLayout';
import { collapseNode } from '../parser/collapseAST';
import TwoTextNodeComponent from './nodes/TwoTextNode';
import { HyperFormulaProvider } from './context';
import type { HyperFormula } from 'hyperformula';
import ReferenceNodeComponent from './nodes/referenceNode';
import RangeNodeComponent from './nodes/rangeNode';
import NumberNodeComponent from './nodes/numberNode';
import StringNodeComponent from './nodes/stringNode';
import FunctionNodeComponent from './nodes/functionNode';

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

  useEffect(() => {
    if (ast === undefined) {
      setNodes([]);
      setEdges([]);
    } else {
      resetNodeIdCounter();
      const collapsedTree = collapseNode(ast);
      const G = toGraph(collapsedTree, visitCollapsedNode);
      const layoutedG = applyDagreLayout(G);
      setNodes(layoutedG.nodes);
      setEdges(layoutedG.edges);
    }
  }, [ast, setNodes, setEdges]);

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