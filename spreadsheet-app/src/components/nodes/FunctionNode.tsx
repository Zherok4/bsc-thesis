import { type JSX, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import { evaluateFormula } from "../../utils";
import './FunctionNode.css';

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
                    <span className="func-symbol">ƒ</span>
                    <span className="func-name">{funName}</span>
                    </div>
                    <span className="node-type">Function</span>
                </div>
            
                <div className="node-body">
                    <div className="formula">{formulaReplacedWithArgNames}</div>
                    
                    <div className="args">
                        <span className="args-label">Arguments</span>
                        {
                            argFormulas.map((formula, idx) => (
                                <div key={idx} className="arg">
                                    <Handle
                                        type="target"
                                        position={Position.Left}
                                        id={`arghandle-${idx}`}
                                        className="arg-handle"
                                    />
                                    <span className="arg-label">{`arg${idx}`}</span>
                                    <span className="arg-value">{formula}</span>
                                </div>
                            ))
                        }
                    </div>
                    
                    <div className="result">
                        <span className="result-label">Result</span>
                        <span className="result-value">{output || '—'}</span>
                    </div>
                </div>
            </div>
            {/* Output handle - Right for LR layout */}
            <Handle type="source" position={Position.Right} />
        </div>
    );
}