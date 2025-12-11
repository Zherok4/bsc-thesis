import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useMemo, type JSX } from "react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import type { CellValue, SimpleCellAddress } from "hyperformula";
import "./referenceNode.css"

export type ReferenceNode = Node<
{
    reference: string,
    sheet?: string,
},
'ReferenceNode'
>;
// TODO: Make standard reference format ==> i.e also if anode has Sheet prefix ==> extract it / remove from reference 
export default function ReferenceNodeComponent({data: {reference, sheet}}: NodeProps<ReferenceNode>): JSX.Element {
    const { hfInstance, activeSheetName }: HyperFormulaContextValue = useHyperFormula();
    const sheetId = useMemo<number | undefined>(() => {
        return hfInstance.getSheetId(sheet || activeSheetName)
    }, [sheet, activeSheetName, hfInstance]);
    // TODO: Improve Error handling
    const simpleCellAddress = useMemo<SimpleCellAddress | undefined>(() => {
        return hfInstance.simpleCellAddressFromString(reference, sheetId || 0)
    }, [reference, hfInstance]);
    const cellValue = useMemo<CellValue | undefined>(() => {
        if (!simpleCellAddress) {
            return undefined;
        } else {
            return hfInstance.getCellValue(simpleCellAddress);
        }
    }, [simpleCellAddress, hfInstance]);

    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="ref-node">
                <div className="node-header">
                    <span className="cell-ref">{reference}</span>
                    <span className="node-type">Cell</span>
                </div>

                <div className="node-body">
                    <div className="value-row">
                        <span className="value-label">Value</span>
                        <span className="value-display">{String(cellValue ?? "")}</span>
                    </div>
                </div>

                <div className="node-footer">
                    <div className="sheet-icon">
                        <span></span><span></span><span></span>
                        <span></span><span></span><span></span>
                    </div>
                    <span className="sheet-name">{sheet || activeSheetName}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
}