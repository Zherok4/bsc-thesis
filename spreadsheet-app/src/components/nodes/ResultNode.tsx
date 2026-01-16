import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { JSX } from "react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import { evaluateFormula } from "../../utils";
import "./ResultNode.css"

export type ResultNode = Node<
{
    formula: string,
    sheet: string,
},
'ResultNode'
>;

export default function ResultNodeComponent({data: {formula, sheet}}: NodeProps<ResultNode>): JSX.Element {
    const { hfInstance }: HyperFormulaContextValue = useHyperFormula();

    // Note: No useMemo - we need fresh values on every render when cell values change
    const output: string = evaluateFormula(formula, hfInstance, sheet);

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
