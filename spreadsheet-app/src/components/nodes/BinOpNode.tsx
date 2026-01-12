import type { Node, NodeProps } from "@xyflow/react";
import { type JSX } from "react";
import { Handle, Position } from "@xyflow/react";
import { abbreviateNumber, truncateMiddle } from "./utils";
import './BinOpNode.css';
import EditableConstant, { type ConstantType } from "./EditableConstant";
import type { SourceCell } from "../context/GraphEditModeContext";
import { useConnectionDrag } from "../context";

/**
 * Information about a constant operand for editing purposes
 */
export interface ConstantOperandInfo {
    /** The AST node ID of the constant */
    astNodeId: string;
    /** The type of the constant (number or string) */
    type: ConstantType;
    /** The raw value (number for numbers, unquoted string for strings) */
    rawValue: string | number;
}

export type BinOpNode = Node<
{
    operator: string;
    leftConstant?: string;
    rightConstant?: string;
    /** Info about the left constant operand for editing (if it's a constant) */
    leftConstantInfo?: ConstantOperandInfo;
    /** Info about the right constant operand for editing (if it's a constant) */
    rightConstantInfo?: ConstantOperandInfo;
    /** AST node ID for the left operand (for edge deletion) */
    leftOperandAstNodeId?: string;
    /** AST node ID for the right operand (for edge deletion) */
    rightOperandAstNodeId?: string;
    /** Source cell for nodes within expanded branches (for edit routing) */
    sourceCell?: SourceCell;
},
'BinOpNode'
>;

/**
 * Mirrors asymmetric comparison operators.
 * Used when the left operand is displayed on the right side.
 * For example: `5 > x` becomes `x < 5` when displayed.
 */
function getMirroredOperator(operator: string): string {
    switch (operator) {
        case ">": return "<";
        case "<": return ">";
        case ">=": return "<=";
        case "<=": return ">=";
        default: return operator;
    }
}

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
 * Displays in horizontal left-to-right format: [left] operator [right] -> result
 * When only one operand is a constant, it is always displayed on the right side.
 */
export default function BinOpNodeComponent({ id, data: { operator, leftConstant, rightConstant, leftConstantInfo, rightConstantInfo, sourceCell } }: NodeProps<BinOpNode>): JSX.Element {
    const { state: dragState, isHandleValid } = useConnectionDrag();

    // When only one constant exists, always show it on the right side for consistency
    const hasOnlyLeftConstant = leftConstant && !rightConstant;
    const hasBothConstants = leftConstant && rightConstant;

    // Determine what to show on the left side (only show constant if both sides have constants)
    const showLeftConstant = hasBothConstants && leftConstant;
    const leftDisplayValue = showLeftConstant ? leftConstant : undefined;
    const leftDisplayInfo = showLeftConstant ? leftConstantInfo : undefined;

    // Determine what to show on the right side (show right constant, or left constant if only left exists)
    const rightDisplayValue = hasOnlyLeftConstant ? leftConstant : rightConstant;
    const rightDisplayInfo = hasOnlyLeftConstant ? leftConstantInfo : rightConstantInfo;
    const rightEditId = hasOnlyLeftConstant ? `${id}-left` : `${id}-right`;

    // Mirror the operator when the left constant is displayed on the right side
    // e.g., `5 > x` displayed as `[x] < 5`
    const displayOperator = hasOnlyLeftConstant ? getMirroredOperator(operator) : operator;

    // Determine how many handles to show
    const showLeftHandle = !leftConstant;
    const showRightHandle = !rightConstant;
    const showBothHandles = showLeftHandle && showRightHandle;

    // Check handle validity for smart highlighting
    const isLeftHandleValid = !dragState.isDragging || isHandleValid(id, 'left-operand');
    const isRightHandleValid = !dragState.isDragging || isHandleValid(id, 'right-operand');

    return (
        <div className={`node-wrapper binop-node-wrapper`}>
            <div className="selected-indicator"></div>
            <div className="binop-node">
                {/* Left operand handle - show when left is NOT a constant */}
                {showLeftHandle && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="left-operand"
                        className={`binop-handle-input ${showBothHandles ? 'binop-handle-left' : ''} ${!isLeftHandleValid ? 'handle-invalid' : ''}`}
                    />
                )}

                {/* Right operand handle - show when right is NOT a constant */}
                {showRightHandle && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="right-operand"
                        className={`binop-handle-input ${showBothHandles ? 'binop-handle-right' : ''} ${!isRightHandleValid ? 'handle-invalid' : ''}`}
                    />
                )}

                {/* Left operand - only show constant if both sides have constants */}
                <div className={`binop-operand binop-left ${!leftDisplayValue ? 'binop-empty' : ''}`}>
                    {leftDisplayValue && leftDisplayInfo && (
                        <EditableConstant
                            displayValue={formatConstant(leftDisplayValue).display}
                            rawValue={leftDisplayInfo.rawValue}
                            type={leftDisplayInfo.type}
                            astNodeId={leftDisplayInfo.astNodeId}
                            editId={`${id}-left`}
                            title={leftDisplayValue}
                            variant="popover"
                            sourceCell={sourceCell}
                        />
                    )}
                    {leftDisplayValue && !leftDisplayInfo && (
                        <span className="binop-constant-display" title={leftDisplayValue}>
                            {formatConstant(leftDisplayValue).display}
                        </span>
                    )}
                </div>

                {/* Operator */}
                <span className="binop-operator">{getDisplayOperator(displayOperator)}</span>

                {/* Right operand - shows the single constant when only one exists */}
                <div className={`binop-operand binop-right ${!rightDisplayValue ? 'binop-empty' : ''}`}>
                    {rightDisplayValue && rightDisplayInfo && (
                        <EditableConstant
                            displayValue={formatConstant(rightDisplayValue).display}
                            rawValue={rightDisplayInfo.rawValue}
                            type={rightDisplayInfo.type}
                            astNodeId={rightDisplayInfo.astNodeId}
                            editId={rightEditId}
                            title={rightDisplayValue}
                            variant="popover"
                            sourceCell={sourceCell}
                        />
                    )}
                    {rightDisplayValue && !rightDisplayInfo && (
                        <span className="binop-constant-display" title={rightDisplayValue}>
                            {formatConstant(rightDisplayValue).display}
                        </span>
                    )}
                </div>

                {/* Output handle on the right side */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id="result"
                    className="binop-handle-output"
                />
            </div>
        </div>
    );
}
