import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { useHyperFormula, useGraphEditMode, type HyperFormulaContextValue, type GraphEditModeContextValue } from "../context";
import type { CellValue, SimpleCellAddress } from "hyperformula";
import "./referenceNode.css"

export type ReferenceNode = Node<
{
    reference: string,
    sheet?: string,
    hasFormula?: boolean,
},
'ReferenceNode'
>;
// TODO: Make standard reference format ==> i.e also if anode has Sheet prefix ==> extract it / remove from reference
export default function ReferenceNodeComponent({id, data: {reference, sheet, hasFormula}}: NodeProps<ReferenceNode>): JSX.Element {
    const { hfInstance, activeSheetName, selectedCell }: HyperFormulaContextValue = useHyperFormula();
    const { isEditModeActive, setEditMode, editingNodeId, setEditingNodeId }: GraphEditModeContextValue = useGraphEditMode();
    const isThisNodeBeingEdited = editingNodeId === id;

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isEditModeActive) {
            setEditMode(true);
            setEditingNodeId(id);
            return;
        }

        /** Edit Mode is already Active */
        if (!isThisNodeBeingEdited) {
            setEditMode(true);
            setEditingNodeId(id);
        }
    }, [setEditMode, isEditModeActive, isThisNodeBeingEdited, setEditingNodeId, id]);

    // TODO: change sheet reference
    const internalReference: string | undefined = useMemo(() => {
        
        if (!isEditModeActive) return reference;

        if (!isThisNodeBeingEdited) return reference;

        if (selectedCell === null) return reference;

        const sheetId = hfInstance.getSheetId(activeSheetName);
        if (sheetId === undefined) return reference;

        const simpleCellAddressOfSelectedCell = { sheet: sheetId, col: selectedCell.col, row: selectedCell.row};
        try {
            return hfInstance.simpleCellAddressToString(
                simpleCellAddressOfSelectedCell, 
                {includeSheetName: false}
            ) ?? reference;
        } catch (e) {
            return reference;
        }

    }, [selectedCell, activeSheetName, isEditModeActive, editingNodeId]);

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
                    <div
                        className="cell-ref"
                        onDoubleClick={e => handleDoubleClick(e)}
                        title="double click to change Reference"
                    >
                        {internalReference}
                    </div>
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
            {hasFormula && <Handle type="target" position={Position.Left} />}
            <Handle type="source" position={Position.Right} />
        </div>
    );
}