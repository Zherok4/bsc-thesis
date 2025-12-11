import { type JSX, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import './functionNode.css';

export type FunctionNode = Node<
{
    funName: string,
    argFormulas: string[],
    funFormula: string,
},
'FunctionNode'
>;

export default function FunctionNodeComponent({data: {funName, argFormulas, funFormula}}: NodeProps<FunctionNode>): JSX.Element {
    const { hfInstance, activeSheetName }: HyperFormulaContextValue = useHyperFormula();
    const sheetId: number | undefined = useMemo<number | undefined>(() => {
        return hfInstance.getSheetId(activeSheetName);
    }, [activeSheetName, hfInstance]);
    const output: string = useMemo<string>(() => {
        if (sheetId === undefined) {
            return '#SHEET?';
        }
        try {
            const formulaToEvaluate = funFormula.startsWith('=') ? funFormula : `=${funFormula}`;
            const result = hfInstance.calculateFormula(formulaToEvaluate, sheetId);

            if (result === null || result === undefined) {
                return '';
            }

            if (Array.isArray(result)) {
                if (Array.isArray(result[0])) {
                    return `${result[0][0]}, ...`;
                }
                return `${result[0]}, ...`;
            }

            return String(result);
        } catch (error) {
            console.error('Formula evaluation error:', error);
            return '#ERROR';
        }
    }, [funFormula, sheetId, hfInstance]); 




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
                    <div className="formula">{funFormula}</div>
                    
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
                                        style={{
                                            position: "absolute",
                                            left: "-16px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                        }}
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