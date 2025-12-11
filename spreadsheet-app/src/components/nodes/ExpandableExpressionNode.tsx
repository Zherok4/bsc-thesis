import type { NodeProps, Node } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react";
import { useMemo } from "react";
import { useHyperFormula } from "../context";
import './ExpandableExpressionNode.css'

export type ExpandableExpressionNode = Node<
{
    formula: string,
    isExpanded: boolean,
    onToggleExpand: (nodeId: string) => void,
    nodeId: string,
},
'ExpandableExpressionNode'
>;

export default function ExpandableExpressionNodeComponent(props: NodeProps<ExpandableExpressionNode>) {
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

            const formulaToEvaluate = formula.startsWith('=') ? formula : `=${formula}`;
            const result = hfInstance.calculateFormula(formulaToEvaluate, sheetId);

            if (result === null || result === undefined) {
                return '';
            }

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
    }, [props.data.formula, hfInstance, activeSheetName]);

    const handleToggle = () => {
        props.data.onToggleExpand(props.data.nodeId);
    };

    return (
        <div className={`expandable-expression-node ${props.data.isExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="node-header">
                <button
                    className="expand-toggle"
                    onClick={handleToggle}
                    title={props.data.isExpanded ? "Collapse details" : "Expand details"}
                >
                    {props.data.isExpanded ? '−' : '+'}
                </button>
                <span className="expand-hint">
                    {props.data.isExpanded ? 'Details shown' : 'Click + to expand'}
                </span>
            </div>
            <div className="node-content">
                <p className="label">Formula:</p>
                <p className="value">{props.data.formula}</p>
                {evaluatedOutput && (
                    <>
                        <p className="label">Output:</p>
                        <p className="value">{evaluatedOutput}</p>
                    </>
                )}
            </div>
            <Handle type="source" position={Position.Right} />
            <Handle type="target" position={Position.Left} />
        </div>
    );
}
