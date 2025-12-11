import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useMemo, type JSX } from "react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import "./resultNode.css"

export type ResultNode = Node<
{
    formula: string,
},
'ResultNode'
>;

export default function ResultNodeComponent({data: {formula}}: NodeProps<ResultNode>): JSX.Element {
    const { hfInstance, activeSheetName }: HyperFormulaContextValue = useHyperFormula();

    const output = useMemo<string>(() => {
        if (!formula || formula.trim() === '') {
            return '';
        }

        try {
            const sheetId = hfInstance.getSheetId(activeSheetName);
            if (sheetId === undefined) {
                return '#SHEET?';
            }

            const formulaToEvaluate = formula.startsWith('=') ? formula : `=${formula}`;
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
    }, [formula, hfInstance, activeSheetName]);

    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="result-node">
                <div className="node-header">
                    <span className="result-icon">=</span>
                    <span className="node-type">Result</span>
                </div>

                <div className="node-body">
                    <div className="value-display">{output || '—'}</div>
                </div>
            </div>
            <Handle type="target" position={Position.Left} />
        </div>
    );
}
