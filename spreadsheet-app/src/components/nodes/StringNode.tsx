import type { Node, NodeProps } from "@xyflow/react";
import { type JSX } from "react";
import { Handle, Position } from "@xyflow/react";
import './StringNode.css';

export type StringNode = Node<
{
    value: string,
},
'StringNode'
>;

export default function StringNodeComponent({data: {value}}: NodeProps<StringNode>): JSX.Element {
    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="literal-node string-node">
            <div className="node-header">
                <span className="type-badge">Str</span>
                <span className="node-type">Literal</span>
            </div>
            
            <div className="node-body">
                <div className="value-display">
                    <span className="quote">"</span>
                    <span>{value}</span>
                    <span className="quote">"</span>
                    <Handle type="source" position={Position.Right} className="value-handle" />
                </div>
            </div>
            </div>
        </div>
    )
}