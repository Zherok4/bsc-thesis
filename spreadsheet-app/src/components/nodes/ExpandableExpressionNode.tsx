import type { NodeProps, Node } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react";
import { useMemo } from "react";
import { useHyperFormula } from "../context";
import { evaluateFormula } from "../../utils";
import './ExpandableExpressionNode.css'

export type ExpandableExpressionNode = Node<
{
    formula: string,
    isExpanded: boolean,
    onToggleExpand: (nodeId: string) => void,
    nodeId: string,
    isConnectedToFunctionArg?: boolean,
},
'ExpandableExpressionNode'
>;

export default function ExpandableExpressionNodeComponent(props: NodeProps<ExpandableExpressionNode>) {
    const { hfInstance, activeSheetName } = useHyperFormula();

    const evaluatedOutput = useMemo(
        () => evaluateFormula(props.data.formula, hfInstance, activeSheetName),
        [props.data.formula, hfInstance, activeSheetName]
    );

    const handleToggle = () => {
        props.data.onToggleExpand(props.data.nodeId);
    };

    if (!props.data.isExpanded) {
        return (
            <div className="expandable-expression-node minimal">
                <button
                    className="expand-toggle"
                    onClick={handleToggle}
                    title="Expand details"
                >
                    ...
                </button>
                <Handle type="source" position={Position.Right} />
                <Handle type="target" position={Position.Left} />
            </div>
        );
    }

    return (
        <div className="expandable-expression-node expanded">
            <div className="node-header">
                <button
                    className="expand-toggle"
                    onClick={handleToggle}
                    title="Collapse details"
                >
                    −
                </button>
                <span className="expand-hint">Details shown</span>
            </div>
            <div className="node-content">
                <p className="label">Formula:</p>
                <p className="value">{props.data.formula}</p>
                {evaluatedOutput && (
                    <>
                        <p className="label">Output:</p>
                        <p className="value">{evaluatedOutput}</p>
                    </>
                )}
            </div>
            <Handle type="source" position={Position.Right} />
            <Handle type="target" position={Position.Left} />
        </div>
    );
}
