import { type JSX, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import { evaluateFormula } from "../../utils";
import './FunctionNode.css';
import { getParameterName } from "../../data/functionParameters";

export type FunctionNode = Node<
{
    funName: string,
    argFormulas: string[],
    funFormula: string,
},
'FunctionNode'
>;

function replaceAll(argFormulatoNameMap: Map<string, string>, target: string): string {
    let result: string = target;
    argFormulatoNameMap.forEach((name, formula) => {
        result = result.replace(formula, name);
    });
    return result;
}

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

export default function FunctionNodeComponent({data: {funName, argFormulas, funFormula}}: NodeProps<FunctionNode>): JSX.Element {
    const { hfInstance, activeSheetName }: HyperFormulaContextValue = useHyperFormula();

    const output: string = useMemo<string>(
        () => evaluateFormula(funFormula, hfInstance, activeSheetName),
        [funFormula, hfInstance, activeSheetName]
    ); 
    
    const argFormulaToNameMap: Map<string, string> = useMemo<Map<string, string>>(() => {
        const map = new Map<string, string>();
        argFormulas.forEach((formula, idx) => {
            map.set(formula, `arg${idx}`);
        })
        return map;
    }, [argFormulas]);



    const formulaReplacedWithArgNames: string = useMemo<string>(() => {
        return replaceAll(argFormulaToNameMap, funFormula);
    }, [funFormula, argFormulaToNameMap]);


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
                        <span className="args-label">Arguments</span>
                        {
                            argFormulas.map((formula, idx) => {
                                const constantValue = getConstantValue(formula);
                                return (
                                    <div key={idx} className="arg">
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={`arghandle-${idx}`}
                                            className="arg-handle"
                                        />
                                        <span className="arg-label">{getParameterName(funName, idx)}</span>
                                        {constantValue && (
                                            <span className="arg-value">{constantValue}</span>
                                        )}
                                    </div>
                                );
                            })
                        }
                    </div>
                    
                    <div className="result">
                        <span className="result-label">Result</span>
                        <span className="result-value">{output || '—'}</span>
                        <Handle type="source" position={Position.Right} className="value-handle"/>
                    </div>
                </div>
            </div>
        </div>
    );
}