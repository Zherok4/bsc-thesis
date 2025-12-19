import type { Node, NodeProps } from "@xyflow/react";
import { type JSX } from "react";
import { Handle, Position } from "@xyflow/react";
import { abbreviateNumber, truncateMiddle } from "./utils";
import './BinOpNode.css';

export type BinOpNode = Node<
{
    operator: string;
    leftConstant?: string;
    rightConstant?: string;
},
'BinOpNode'
>;

/**
 * Maps raw operator symbols to display-friendly versions
 */
function getDisplayOperator(operator: string): string {
    switch (operator) {
        case "*": return "×";
        case "/": return "÷";
        case ">=": return "≥";
        case "<=": return "≤";
        default: return operator;
    }
}

/**
 * Formats a constant for display: abbreviates and truncates if needed.
 */
function formatConstant(value: string): { display: string; full: string } {
    const abbreviated = abbreviateNumber(value);
    return {
        display: truncateMiddle(abbreviated, 5),
        full: value
    };
}

/**
 * A compact node representing a binary operation with two inputs and one output.
 * Displays the operator symbol in the center and shows constants inline.
 */
export default function BinOpNodeComponent({ data: { operator, leftConstant, rightConstant } }: NodeProps<BinOpNode>): JSX.Element {
    const hasConstants = leftConstant || rightConstant;

    return (
        <div className={`node-wrapper binop-node-wrapper`}>
            <div className="selected-indicator"></div>
            <div className="binop-node">
                <div className="binop-inputs">
                    <div className="binop-operand">
                        <Handle
                            type="target"
                            position={Position.Left}
                            id="left-operand"
                            className="binop-handle-input"
                        />
                        {leftConstant && (
                            <span className="binop-constant" title={leftConstant}>
                                {formatConstant(leftConstant).display}
                            </span>
                        )}
                    </div>
                    <div className="binop-operand">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id="right-operand"
                                className="binop-handle-input"
                            />
                        {rightConstant && (
                            <span className="binop-constant" title={rightConstant}>
                                {formatConstant(rightConstant).display}
                            </span>
                        )}
                    </div>
                </div>

                <span className="binop-operator">{getDisplayOperator(operator)}</span>

                <Handle
                    type="source"
                    position={Position.Right}
                    id="result"
                    className="binop-handle binop-handle-output"
                />
            </div>
        </div>
    );
}
