import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useMemo, type JSX } from "react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import type { SimpleCellAddress } from "hyperformula";
import "./RangeNode.css"

export type RangeNode = Node<
{
    startReference: string,
    endReference: string,
    sheet?: string,
},
'RangeNode'
>;

export default function RangeNodeComponent({data: {startReference, endReference, sheet}}: NodeProps<RangeNode>): JSX.Element {
    const { hfInstance, activeSheetName }: HyperFormulaContextValue = useHyperFormula();
    const sheetId = useMemo<number | undefined>(() => {return hfInstance.getSheetId(sheet || activeSheetName)}, [sheet, activeSheetName, hfInstance]);
        // TODO: Improve Error handling
    const simpleCellAddressStart: SimpleCellAddress | undefined = useMemo<SimpleCellAddress | undefined>(() => {
        return hfInstance.simpleCellAddressFromString(startReference, sheetId || 0)
    }, [startReference, hfInstance]);
    const simpleCellAddressEnd: SimpleCellAddress | undefined = useMemo<SimpleCellAddress | undefined>(() => {
        return hfInstance.simpleCellAddressFromString(endReference, sheetId || 0)
    }, [endReference, hfInstance]);
    const numRows: number = Math.abs((simpleCellAddressStart?.row || 0) - (simpleCellAddressEnd?.row || 0)) + 1;
    const numCols: number = Math.abs((simpleCellAddressStart?.col || 0) - (simpleCellAddressEnd?.col || 0)) + 1;



    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="range-node">
                <div className="node-header">
                    <span className="range-ref">
                        <span>{startReference}</span>
                        <span className="range-separator">:</span>
                        <span>{endReference}</span>
                    </span>
                    <span className="node-type">Range</span>
                </div>
                <div className="node-body">
                    <div className="range-preview">
                    <div className="range-visual">
                        <div className="range-cell"></div>
                        <div className="range-cell"></div>
                        <div className="range-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                        </div>
                        <div className="range-cell"></div>
                        <div className="range-cell"></div>
                    </div>
                    <div className="range-stats">
                        <div className="stat">
                        <span className="stat-label">Cells</span>
                        <span className="stat-value">{numRows * numCols}</span>
                        </div>
                    </div>
                    </div>
                    
                    <div className="dimensions">
                    <div className="dim">
                        <span className="dim-label">Rows</span>
                        <span className="dim-value">{numRows}</span>
                    </div>
                    <div className="dim">
                        <span className="dim-label">Cols</span>
                        <span className="dim-value">{numCols}</span>
                    </div>
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
    )
}