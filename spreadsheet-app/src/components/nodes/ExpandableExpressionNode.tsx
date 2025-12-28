import type { NodeProps, Node } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react";
import { useMemo, useCallback, type JSX } from "react";
import { useHyperFormula } from "../context";
import { evaluateFormula } from "../../utils";
import { abbreviateNumber } from "./utils";
import './ExpandableExpressionNode.css'

/** Represents a variable in the math expression with its name and current value */
interface ExpressionVariable {
    name: string;
    value: string;
}

export type ExpandableExpressionNode = Node<
{
    formula: string,
    isExpanded: boolean,
    onToggleExpand: (nodeId: string) => void,
    nodeId: string,
    variables?: ExpressionVariable[],
    isConnectedToFunctionArg?: boolean,
},
'ExpandableExpressionNode'
>;

/**
 * A compact math expression node that displays the formula and allows
 * expansion via double-click to show additional details.
 */
export default function ExpandableExpressionNodeComponent(props: NodeProps<ExpandableExpressionNode>): JSX.Element {
    const { hfInstance, activeSheetName } = useHyperFormula();
    const { formula, isExpanded, onToggleExpand, nodeId, variables = [] } = props.data;

    const residingSheet = useMemo<string>(() => {
        return activeSheetName;
    }, []);

    const evaluatedOutput = useMemo(
        () => evaluateFormula(formula, hfInstance, residingSheet),
        [formula, hfInstance, residingSheet]
    );

    const handleDoubleClick = useCallback(() => {
        onToggleExpand(nodeId);
    }, [onToggleExpand, nodeId]);

    return (
        <div
            className={`math-expression-node ${isExpanded ? 'expanded' : 'minimized'}`}
            onDoubleClick={handleDoubleClick}
        >
            <div className="math-expression-header">
                <span className="math-formula" title={formula}>{formula}</span>
                <span className="math-label">Math Expression</span>
            </div>

            <div className="math-expression-body">
                <div className="math-inputs">
                    {variables.map((variable) => (
                        <div key={variable.name} className="math-variable">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={`var-${variable.name}`}
                                className="math-handle-input"
                            />
                            <span className="variable-name">{variable.name}</span>
                            <span className="variable-value">{variable.value}</span>
                        </div>
                    ))}
                    {variables.length === 0 && (
                        <div className="math-variable">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id="input"
                                className="math-handle-input"
                            />
                        </div>
                    )}
                </div>

                <div className="math-output">
                    <span className="output-label">Result:</span>
                    <span className="node-result-value" title={evaluatedOutput}>{evaluatedOutput ? abbreviateNumber(evaluatedOutput) : '-'}</span>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="output"
                        className="math-handle-output"
                    />
                </div>
            </div>

        </div>
    );
}
