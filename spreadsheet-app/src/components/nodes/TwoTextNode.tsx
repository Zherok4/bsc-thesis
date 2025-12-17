import type { NodeProps, Node } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react";
import { useMemo } from "react";
import { useHyperFormula } from "../context";
import { evaluateFormula } from "../../utils";
import './TwoTextNode.css'

export type TwoTextNode = Node<
{
    formula: string,
},
'TwoTextNode'
>;

export default function TwoTextNodeComponent(props: NodeProps<TwoTextNode>) {
    const { hfInstance, activeSheetName } = useHyperFormula();

    const evaluatedOutput = useMemo(
        () => evaluateFormula(props.data.formula, hfInstance, activeSheetName),
        [props.data.formula, hfInstance, activeSheetName]
    );

    return (
        <div className="two-text-node">
            <p>Formula:</p>
            <p>{props.data.formula}</p>
            <p>{evaluatedOutput && "Output:"}</p>
            <p>{evaluatedOutput}</p>
            <Handle type="source" position={Position.Right} />
            <Handle type="target" position={Position.Left} />
        </div>
    );
}
