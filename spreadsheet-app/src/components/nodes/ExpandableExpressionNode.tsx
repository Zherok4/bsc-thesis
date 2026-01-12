import type { NodeProps, Node } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react";
import { useCallback, type JSX } from "react";
import { useHyperFormula } from "../context";
import { evaluateFormula } from "../../utils";
import { abbreviateNumber } from "./utils";
import './ExpandableExpressionNode.css'

/** Represents an argument input with a label (A, B, C...) and optional constant value */
interface ExpressionArgument {
    /** The label for this argument (A, B, C, ...) */
    label: string;
    /** The original formula/reference this argument represents */
    originalFormula: string;
    /** If this is a constant value, store it here (won't have a handle) */
    constantValue?: string;
}

export type ExpandableExpressionNode = Node<
{
    /** The original formula for evaluation */
    formula: string,
    /** The formula with references replaced by argument labels (A, B, C...) for display */
    displayFormula: string,
    isExpanded: boolean,
    onToggleExpand: (nodeId: string) => void,
    nodeId: string,
    /** Arguments with labels A, B, C... */
    arguments: ExpressionArgument[],
    isConnectedToFunctionArg?: boolean,
    /** Sheet name where this expression resides */
    sheet: string,
    /** Map of argument index to AST node ID (for edge connections) */
    argAstNodeIds?: Record<number, string>,
},
'ExpandableExpressionNode'
>;

/**
 * A compact math expression node that displays the formula and allows
 * expansion via double-click to show additional details.
 * Uses named arguments (A, B, C...) to represent inputs.
 */
export default function ExpandableExpressionNodeComponent(props: NodeProps<ExpandableExpressionNode>): JSX.Element {
    const { hfInstance } = useHyperFormula();
    const { formula, displayFormula, isExpanded, onToggleExpand, nodeId, arguments: args = [], sheet } = props.data;

    const residingSheet = sheet;

    // Note: No useMemo - we need fresh values on every render when cell values change
    const evaluatedOutput = evaluateFormula(formula, hfInstance, residingSheet);

    const handleDoubleClick = useCallback(() => {
        onToggleExpand(nodeId);
    }, [onToggleExpand, nodeId]);

    return (
        <div
            className={`math-expression-node ${isExpanded ? 'expanded' : 'minimized'}`}
            onDoubleClick={handleDoubleClick}
        >
            <div className="math-expression-header">
                <span className="math-formula" title={formula}>{displayFormula}</span>
                <span className="math-label">Math Expression</span>
            </div>

            <div className="math-expression-body">
                <div className="math-inputs">
                    {args.map((arg, idx) => (
                        <div key={arg.label} className="math-variable">
                            {!arg.constantValue && (
                                <Handle
                                    type="target"
                                    position={Position.Left}
                                    id={`arghandle-${idx}`}
                                    className="math-handle-input"
                                />
                            )}
                            <span className="variable-name">{arg.label}</span>
                            {arg.constantValue && (
                                <span className="variable-value">{arg.constantValue}</span>
                            )}
                        </div>
                    ))}
                    {args.length === 0 && (
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
