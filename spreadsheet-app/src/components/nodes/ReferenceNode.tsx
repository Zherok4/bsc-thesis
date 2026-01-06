import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useCallback, useMemo, type JSX } from "react";
import { useHyperFormula, useGraphEditMode, type HyperFormulaContextValue, type GraphEditModeContextValue } from "../context";
import type { CellValue, SimpleCellAddress } from "hyperformula";
import { getSheetColorStyle } from "../../utils/sheetColors";
import { useCellHeaders } from "../../hooks";
import splitIcon from "../../assets/split-svgrepo-com.svg";
import type { SourceCell } from "../context/GraphEditModeContext";
import "./ReferenceNode.css"

export type ReferenceNode = Node<
{
    reference: string,
    sheet: string,
    hasFormula?: boolean,
    /** Whether this node is currently expanded (only relevant when hasFormula is true) */
    isExpanded?: boolean,
    /** Callback to toggle expansion state */
    onToggleExpand?: (nodeId: string) => void,
    /** Stable ID used for tracking expansion state */
    expansionNodeId?: string,
    /** AST node ID for identifying this node during edits */
    astNodeId?: string,
    /** Array of AST node IDs when this node represents merged references */
    astNodeIds?: string[],
    /** Reference key for merged nodes (used for unmerge action) */
    mergedRefKey?: string,
    /** Source cell for nodes within expanded branches (for edit routing) */
    sourceCell?: SourceCell,
},
'ReferenceNode'
>;
// TODO: Make standard reference format ==> i.e also if anode has Sheet prefix ==> extract it / remove from reference
export default function ReferenceNodeComponent({id, data: {reference, sheet, hasFormula, isExpanded, onToggleExpand, expansionNodeId, astNodeId, astNodeIds, mergedRefKey, sourceCell}}: NodeProps<ReferenceNode>): JSX.Element {
    const { hfInstance, activeSheetName, selectedCell, scrollToCell, highlightCells, clearHighlight }: HyperFormulaContextValue = useHyperFormula();
    const { isEditModeActive, editingNodeId, enterEditMode, exitEditMode, saveEdit, onUnmerge }: GraphEditModeContextValue = useGraphEditMode();
    const isThisNodeBeingEdited = editingNodeId === id;
    const isExpandable = hasFormula && onToggleExpand && expansionNodeId;

    const residingSheet = sheet;

    const sheetId = useMemo<number | undefined>(() => {
        return hfInstance.getSheetId(residingSheet);
    }, [hfInstance, residingSheet]);

    const sheetColorStyle = useMemo<React.CSSProperties>(() => {
        return getSheetColorStyle(sheetId ?? 0);
    }, [sheetId]);

    // TODO: Improve Error handling
    const simpleCellAddress = useMemo<SimpleCellAddress | undefined>(() => {
        return hfInstance.simpleCellAddressFromString(reference, sheetId || 0)
    }, [reference, sheetId, hfInstance]);
    
    const cellValue = useMemo<CellValue | undefined>(() => {
        if (!simpleCellAddress) {
            return undefined;
        }
        try {
            return hfInstance.getCellValue(simpleCellAddress);
        } catch {
            return '#REF!';
        }
    }, [simpleCellAddress, hfInstance]);

    const { label: headerLabel } = useCellHeaders(
        hfInstance,
        sheetId,
        simpleCellAddress?.row ?? 0,
        simpleCellAddress?.col ?? 0
    );
    

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isEditModeActive || !isThisNodeBeingEdited) {
            enterEditMode(id);
        }
    }, [enterEditMode, isEditModeActive, isThisNodeBeingEdited, id]);

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
            scrollToCell(row, col, residingSheet);
            highlightCells(row, col, row, col, residingSheet);
        }
    }, [simpleCellAddress, scrollToCell, highlightCells, residingSheet]);

    const handleMouseOver = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (simpleCellAddress) {
            const {row, col} = simpleCellAddress;
            highlightCells(row, col, row, col, residingSheet);
        }
    }, [simpleCellAddress, highlightCells, residingSheet]);

    const handleSaveEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        // Use astNodeIds array if available (for merged nodes), otherwise fall back to single astNodeId
        const nodeIds = astNodeIds ?? (astNodeId ? [astNodeId] : []);
        if (nodeIds.length === 0 || selectedCell === null) {
            exitEditMode();
            return;
        }

        const targetSheetId = hfInstance.getSheetId(activeSheetName);
        if (targetSheetId === undefined) {
            exitEditMode();
            return;
        }

        const simpleCellAddressOfSelectedCell = { sheet: targetSheetId, col: selectedCell.col, row: selectedCell.row };
        const newReference = hfInstance.simpleCellAddressToString(
            simpleCellAddressOfSelectedCell,
            { includeSheetName: false }
        );

        if (!newReference) {
            exitEditMode();
            return;
        }

        saveEdit({
            type: 'reference',
            astNodeIds: nodeIds,
            newValue: newReference,
            sheet: activeSheetName,
            sourceCell,
        });
    }, [astNodeId, astNodeIds, selectedCell, activeSheetName, hfInstance, saveEdit, exitEditMode, sourceCell]);

    const handleCancelEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        exitEditMode();
    }, [exitEditMode]);

    /** Whether this node is merged (multiple occurrences combined into one) */
    const isMerged = Boolean(mergedRefKey);

    const handleUnmerge = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (mergedRefKey) {
            onUnmerge(mergedRefKey);
        }
    }, [mergedRefKey, onUnmerge]);

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
        <div className={`node-wrapper ${isThisNodeBeingEdited ? 'editing' : ''} ${isExpanded ? 'expanded' : ''}`} style={sheetColorStyle}>
            <div className="selected-indicator"></div>
            <div className="ref-node" onClick={(e) => handleSimpleClick(e)} onMouseOver={(e) => handleMouseOver(e)} onMouseLeave={clearHighlight}>
                <div className="ref-content" title={headerLabel}>
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
                        <div className="ref-label-stack">
                            {headerLabel && <span className="header-label">{headerLabel}</span>}
                            <div
                                className={`cell-ref ${isThisNodeBeingEdited ? 'editing' : ''}`}
                                onDoubleClick={e => handleDoubleClick(e)}
                                title={"double click to change Reference"}>
                                {internalReference}
                            </div>
                        </div>
                    </div>
                    <div className="ref-right">
                        <span className="node-result-value">{String(cellValue ?? "")}</span>
                        <Handle type="source" position={Position.Right} className="value-handle"/>
                    </div>
                </div>
                {isThisNodeBeingEdited && (
                    <div className="edit-actions">
                        <button
                            className="edit-action-btn save-btn"
                            onClick={handleSaveEdit}
                            title="Save reference change"
                        >
                            ✓
                        </button>
                        <button
                            className="edit-action-btn cancel-btn"
                            onClick={handleCancelEdit}
                            title="Cancel edit"
                        >
                            ✕
                        </button>
                        {isMerged && (
                            <button
                                className="edit-action-btn unmerge-btn"
                                onClick={handleUnmerge}
                                title="Unmerge to edit separately"
                            >
                                <img src={splitIcon} alt="Unmerge" />
                            </button>
                        )}
                    </div>
                )}
            </div>
            {hasFormula && <Handle type="target" position={Position.Left} />}
        </div>
    );
}