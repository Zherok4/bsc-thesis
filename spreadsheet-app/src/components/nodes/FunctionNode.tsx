import { type JSX, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import { evaluateFormula } from "../../utils";
import './FunctionNode.css';
import { getParameterName } from "../../data/functionParameters";
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

export default function FunctionNodeComponent({id, data: {funName, argFormulas, funFormula, sheet, constantArgs, sourceCell}}: NodeProps<FunctionNode>): JSX.Element {
    const { hfInstance }: HyperFormulaContextValue = useHyperFormula();

    const residingSheet = sheet;

    const output: string = useMemo<string>(
        () => evaluateFormula(funFormula, hfInstance, residingSheet),
        [funFormula, hfInstance, residingSheet]
    );

    return (
        <div className="node-wrapper">
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
                                return (
                                    <div key={idx} className="arg">
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={`arghandle-${idx}`}
                                            className="arg-handle"
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