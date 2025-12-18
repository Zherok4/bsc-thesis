import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useMemo, type JSX } from "react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import { evaluateFormula } from "../../utils";
import "./ResultNode.css"

export type ResultNode = Node<
{
    formula: string,
},
'ResultNode'
>;

export default function ResultNodeComponent({data: {formula}}: NodeProps<ResultNode>): JSX.Element {
    const { hfInstance, activeSheetName }: HyperFormulaContextValue = useHyperFormula();

    const output = useMemo<string>(
        () => evaluateFormula(formula, hfInstance, activeSheetName),
        [formula, hfInstance, activeSheetName]
    );

    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="result-node">
                <div className="node-header">
                    <span className="result-icon">=</span>
                    <span className="node-type">Result</span>
                </div>

                <div className="node-body">
                    <div className="node-result-value">{output || '—'}</div>
                </div>
            </div>
            <Handle type="target" position={Position.Left} />
        </div>
    );
}
