import type { Node, NodeProps } from "@xyflow/react";
import { type JSX } from "react";
import { Handle, Position } from "@xyflow/react";
import './numberNode.css';

export type NumberNode = Node<
{
    value: number,
},
'NumberNode'
>;

export default function NumberNodeComponent({data: {value}}: NodeProps<NumberNode>): JSX.Element {
    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="literal-node number-node">
            <div className="node-header">
                <span className="type-badge">Num</span>
                <span className="node-type">Literal</span>
            </div>
            
            <div className="node-body">
                <div className="value-display">{value}</div>
            </div>
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    )
}