import type { JSX } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useHyperFormula, type HyperFormulaContextValue, useConnectionDrag } from "../context";
import { evaluateFormula } from "../../utils";
import './FunctionNode.css';
import { getParameterName } from "../../data/functionParameters";
import { isVariadicFunction } from "../../data/variadicFunctions";
import EditableConstant, { type ConstantType } from "./EditableConstant";
import type { SourceCell } from "../context/GraphEditModeContext";

/**
 * Information about a constant argument for editing purposes
 */
export interface ConstantArgInfo {
    /** The AST node ID of the constant */
    astNodeId: string;
    /** The type of the constant (number or string) */
    type: ConstantType;
    /** The raw value (number for numbers, unquoted string for strings) */
    rawValue: string | number;
}

export type FunctionNode = Node<
{
    funName: string,
    argFormulas: string[],
    funFormula: string,
    /** Sheet name where this function resides */
    sheet: string,
    /** Map of argument index to constant info (only present for constant arguments) */
    constantArgs?: Record<number, ConstantArgInfo>,
    /** Source cell for nodes within expanded branches (for edit routing) */
    sourceCell?: SourceCell,
    /** Map of argument index to AST node ID (for all arguments, used in edge connections) */
    argAstNodeIds?: Record<number, string>,
    /** AST node ID of the FunctionCall node itself (for adding arguments to variadic functions) */
    functionAstNodeId?: string,
},
'FunctionNode'
>;

/**
 * Checks if a formula is a constant value (number or string literal).
 * Returns the constant value if it is, otherwise returns null.
 */
function getConstantValue(formula: string): string | null {
    const trimmed = formula.trim();

    // Check for number (including negatives and decimals)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return trimmed;
    }

    // Check for string literal (wrapped in double quotes)
    if (/^".*"$/.test(trimmed)) {
        return trimmed;
    }

    return null;
}

export default function FunctionNodeComponent({id, data: {funName, argFormulas, funFormula, sheet, constantArgs, sourceCell, functionAstNodeId}}: NodeProps<FunctionNode>): JSX.Element {
    const { hfInstance }: HyperFormulaContextValue = useHyperFormula();
    const { state: dragState, isHandleValid } = useConnectionDrag();

    const residingSheet = sheet;

    // Note: No useMemo - we need fresh values on every render when cell values change
    const output: string = evaluateFormula(funFormula, hfInstance, residingSheet);

    // Show drop zone for variadic functions when dragging
    const showDropZone = dragState.isDragging && isVariadicFunction(funName) && functionAstNodeId;

    return (
        <div className="node-wrapper" data-function-ast-node-id={functionAstNodeId}>
            <div className="selected-indicator"></div>

            <div className="func-node">
                <div className="node-header">
                    <div className="header-left">
                    <span className="func-symbol">ƒ|</span>
                    <span className="func-name">{funName}</span>
                    </div>

                </div>

                <div className="node-body">


                    <div className="args">
                        <span className="args-label">{argFormulas.length > 0 && "Arguments"}</span>
                        {
                            argFormulas.map((formula, idx) => {
                                const constantValue = getConstantValue(formula);
                                const constantInfo = constantArgs?.[idx];
                                const handleId = `arghandle-${idx}`;
                                const isValid = !dragState.isDragging || isHandleValid(id, handleId);
                                return (
                                    <div key={idx} className="arg">
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={handleId}
                                            className={`arg-handle ${!isValid ? 'handle-invalid' : ''}`}
                                        />
                                        <span className="arg-label">{getParameterName(funName, idx)}</span>
                                        {constantValue && constantInfo && (
                                            <EditableConstant
                                                displayValue={constantValue}
                                                rawValue={constantInfo.rawValue}
                                                type={constantInfo.type}
                                                astNodeId={constantInfo.astNodeId}
                                                editId={`${id}-arg-${idx}`}
                                                className="arg-value"
                                                sourceCell={sourceCell}
                                            />
                                        )}
                                        {constantValue && !constantInfo && (
                                            <span className="arg-value">{constantValue}</span>
                                        )}
                                    </div>
                                );
                            })
                        }

                        {/* Drop zone for adding arguments to variadic functions */}
                        {showDropZone && (
                            <div className="variadic-drop-zone" data-drop-zone="true">
                                <span className="drop-zone-text">+ Add argument</span>
                            </div>
                        )}
                    </div>

                    <div className="result">
                        <span className="result-label">Result</span>
                        <span className="node-result-value">{output || '—'}</span>
                        <Handle type="source" position={Position.Right} className="value-handle"/>
                    </div>
                </div>
            </div>
        </div>
    );
}