import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useCallback, useMemo, type JSX } from "react";
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
    const { hfInstance, activeSheetName, scrollToCell, highlightCells }: HyperFormulaContextValue = useHyperFormula();
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

    const handleClick = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();

        if (simpleCellAddressStart && simpleCellAddressEnd) {
            const startRow = Math.min(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const startCol = Math.min(simpleCellAddressStart.col, simpleCellAddressEnd.col);
            const endRow = Math.max(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const endCol = Math.max(simpleCellAddressStart.col, simpleCellAddressEnd.col);

            scrollToCell(startRow, startCol, sheet);
            highlightCells(startRow, startCol, endRow, endCol, sheet);
        }
    }, [simpleCellAddressStart, simpleCellAddressEnd, scrollToCell, highlightCells, sheet]);



    return (
        <div className="node-wrapper">
            <div className="selected-indicator"></div>
            <div className="range-node" onClick={handleClick}>
                <span className="sheet-name">{sheet || activeSheetName}</span>
                <div className="range-content">
                    <div className="range-left">
                        <span className="range-ref">
                            <span>{startReference}</span>
                            <span className="range-separator">:</span>
                            <span>{endReference}</span>
                        </span>
                    </div>
                    <div className="range-right">
                        <span className="range-preview-value">{numRows * numCols} cells</span>
                    </div>
                </div>
            </div>
            <Handle type="source" position={Position.Right} />
        </div>
    )
}