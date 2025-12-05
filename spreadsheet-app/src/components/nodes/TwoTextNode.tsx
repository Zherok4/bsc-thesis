import type { NodeProps, Node } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react";
import { useMemo } from "react";
import { useHyperFormula } from "../context";
import './TwoTextNode.css'

export type TwoTextNode = Node<
{
    formula: string,
},
'twoTextNode'
>;

export default function TwoTextNodeComponent(props: NodeProps<TwoTextNode>) {
    const { hfInstance, activeSheetName } = useHyperFormula();

    const evaluatedOutput = useMemo(() => {
        const formula = props.data.formula;

        if (!formula || formula.trim() === '') {
            return '';
        }

        try {
            const sheetId = hfInstance.getSheetId(activeSheetName);
            if (sheetId === undefined) {
                return '#SHEET?';
            }

            // HyperFormula requires formulas to start with "="
            const formulaToEvaluate = formula.startsWith('=') ? formula : `=${formula}`;
            const result = hfInstance.calculateFormula(formulaToEvaluate, sheetId);
            
            if (result === null || result === undefined) {
                return '';
            }

            // TODO: Error handling
            if (Array.isArray(result)) {
                if (Array.isArray(result[0])) {
                    return `${result[0][0]}, ...`
                }
                return `${result[0]}, ...`
            }

            return String(result);
        } catch (error) {
            console.error('Formula evaluation error:', error);
            return '#ERROR';
        }
    }, [props.data.formula, hfInstance]);

    return (
        <div className="two-text-node">
            <p>Formula:</p>
            <p>{props.data.formula}</p>
            <p>{evaluatedOutput && "Output:"}</p>
            <p>{evaluatedOutput}</p>
            <Handle type="source" position={Position.Bottom} />
            <Handle type="target" position={Position.Top} />
        </div>
    );
}
