import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useCallback, useMemo, type JSX } from "react";
import { useHyperFormula, useGraphEditMode, type HyperFormulaContextValue, type GraphEditModeContextValue } from "../context";
import type { CellValue, SimpleCellAddress } from "hyperformula";
import { truncateMiddle } from "./utils";
import "./ReferenceNode.css"

export type ReferenceNode = Node<
{
    reference: string,
    sheet?: string,
    hasFormula?: boolean,
    /** Whether this node is currently expanded (only relevant when hasFormula is true) */
    isExpanded?: boolean,
    /** Callback to toggle expansion state */
    onToggleExpand?: (nodeId: string) => void,
    /** Stable ID used for tracking expansion state */
    expansionNodeId?: string,
},
'ReferenceNode'
>;
// TODO: Make standard reference format ==> i.e also if anode has Sheet prefix ==> extract it / remove from reference
export default function ReferenceNodeComponent({id, data: {reference, sheet, hasFormula, isExpanded, onToggleExpand, expansionNodeId}}: NodeProps<ReferenceNode>): JSX.Element {
    const { hfInstance, activeSheetName, selectedCell, scrollToCell, highlightCells, clearHighlight }: HyperFormulaContextValue = useHyperFormula();
    const { isEditModeActive, setEditMode, editingNodeId, setEditingNodeId }: GraphEditModeContextValue = useGraphEditMode();
    const isThisNodeBeingEdited = editingNodeId === id;
    const isExpandable = hasFormula && onToggleExpand && expansionNodeId;


    const residingSheet = useMemo<string>(() => {
        return sheet || activeSheetName;
    }, []);

    const sheetId = useMemo<number | undefined>(() => {
        return hfInstance.getSheetId(residingSheet);
    }, [hfInstance]);

    // TODO: Improve Error handling
    const simpleCellAddress = useMemo<SimpleCellAddress | undefined>(() => {
        return hfInstance.simpleCellAddressFromString(reference, sheetId || 0)
    }, [reference, sheetId, hfInstance]);
    
    const cellValue = useMemo<CellValue | undefined>(() => {
        if (!simpleCellAddress) {
            return undefined;
        } else {
            return hfInstance.getCellValue(simpleCellAddress);
        }
    }, [simpleCellAddress, hfInstance]);

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

    const handleExpandToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isExpandable && onToggleExpand && expansionNodeId) {
            onToggleExpand(expansionNodeId);
        }
    }, [isExpandable, onToggleExpand, expansionNodeId]);

    const handleSimpleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (simpleCellAddress) {
            const {row, col} = simpleCellAddress;
            scrollToCell(row, col, sheet);
            highlightCells(row, col, row, col, sheet);
        }
    }, [simpleCellAddress, scrollToCell, highlightCells, sheet]);

    const handleMouseOver = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (simpleCellAddress) {
            const {row, col} = simpleCellAddress;
            highlightCells(row, col, row, col, sheet);
        }
    }, [simpleCellAddress, highlightCells, sheet]);

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

    }, [selectedCell, activeSheetName, isEditModeActive, isThisNodeBeingEdited, reference, hfInstance]);

    return (
        <div className={`node-wrapper ${isThisNodeBeingEdited ? 'editing' : ''} ${isExpanded ? 'expanded' : ''}`}>
            <div className="selected-indicator"></div>
            <div className="ref-node" onClick={(e) => handleSimpleClick(e)} onMouseOver={(e) => handleMouseOver(e)} onMouseLeave={clearHighlight}>
                <span className="sheet-name" title={residingSheet}>{truncateMiddle(residingSheet, 12)}</span>
                <div className="ref-content">
                    <div className="ref-left">
                        {isExpandable && (
                            <button
                                className={`expand-toggle ${isExpanded ? 'expanded' : ''}`}
                                onClick={handleExpandToggle}
                                title={isExpanded ? 'Collapse formula' : 'Expand formula'}
                            >
                                {isExpanded ? '−' : '+'}
                            </button>
                        )}
                        <div
                            className={`cell-ref ${isThisNodeBeingEdited ? 'editing' : ''}`}
                            onDoubleClick={e => handleDoubleClick(e)}
                            title="double click to change Reference">
                            {internalReference}
                        </div>
                    </div>
                    <div className="ref-right">
                        <span className="node-result-value">{String(cellValue ?? "")}</span>
                        <Handle type="source" position={Position.Right} className="value-handle"/>
                    </div>
                </div>
            </div>
            {hasFormula && <Handle type="target" position={Position.Left} />}
        </div>
    );
}