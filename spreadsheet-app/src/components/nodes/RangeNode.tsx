import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useCallback, useMemo, type JSX } from "react";
import { useHyperFormula, useGraphEditMode, type HyperFormulaContextValue, type GraphEditModeContextValue } from "../context";
import { type CellValue, type SimpleCellAddress } from "hyperformula";
import { getSheetColorStyle } from "../../utils/sheetColors";
import { useRangeHeaders } from "../../hooks";
import splitIcon from "../../assets/split-svgrepo-com.svg";
import type { SourceCell } from "../context/GraphEditModeContext";
import EditableConstant, { type ConstantType } from "./EditableConstant";
import "./RangeNode.css"

/**
 * Converts a 0-based column index to Excel-style column letter(s)
 */
function colIndexToLetter(colIndex: number): string {
    let letter = '';
    let n = colIndex;
    do {
        letter = String.fromCharCode(65 + (n % 26)) + letter;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return letter;
}

/**
 * Union type for range node data supporting cell ranges, column ranges, and row ranges
 */
export type RangeNode = Node<
{
    /** Type of range: cell (A1:B10), column (A:B), or row (1:10) */
    rangeType?: "cell" | "column" | "row";
    /** Start reference for cell ranges (e.g., "A1") */
    startReference?: string;
    /** End reference for cell ranges (e.g., "B10") */
    endReference?: string;
    /** Start column for column ranges (e.g., "A") */
    startColumn?: string;
    /** End column for column ranges (e.g., "B") */
    endColumn?: string;
    /** Start row for row ranges */
    startRow?: number;
    /** End row for row ranges */
    endRow?: number;
    /** Sheet name where this range resides */
    sheet: string;
    /** AST node ID for identifying this node during edits */
    astNodeId?: string;
    /** Array of AST node IDs when this node represents merged ranges */
    astNodeIds?: string[];
    /** Reference key for merged nodes (used for unmerge action) */
    mergedRefKey?: string;
    /** Source cell for nodes within expanded branches (for edit routing) */
    sourceCell?: SourceCell;
    /** Whether this range node is expanded to show cell grid (only for cell ranges) */
    isExpanded?: boolean;
    /** Callback to toggle expansion state */
    onToggleExpand?: (nodeId: string) => void;
    /** Stable ID for tracking expansion state */
    expansionNodeId?: string;
},
'RangeNode'
>;

/** Maximum number of cells to display in the expanded grid */
const MAX_DISPLAYED_CELLS = 50;

/**
 * Represents a cell item in the expanded grid
 */
interface CellGridItem {
    ref: string;
    address: SimpleCellAddress;
    value: CellValue;
    rawValue: string | number;
    type: ConstantType;
    isEditable: boolean;
}

/**
 * Component that renders cell ranges, column ranges, and row ranges
 */
export default function RangeNodeComponent({ id, data }: NodeProps<RangeNode>): JSX.Element {
    const { hfInstance, activeSheetName, selectedRange, scrollToCell, highlightCells, clearHighlight, updateCell }: HyperFormulaContextValue = useHyperFormula();
    const { isEditModeActive, editingNodeId, enterEditMode, exitEditMode, saveEdit, onUnmerge }: GraphEditModeContextValue = useGraphEditMode();

    const isThisNodeBeingEdited = editingNodeId === id;
    const rangeType = data.rangeType ?? "cell"; // Default to cell for backwards compatibility
    const residingSheet = data.sheet;
    const { astNodeId, astNodeIds, mergedRefKey, sourceCell, isExpanded, onToggleExpand, expansionNodeId } = data;

    /** Whether this cell range can be expanded (only cell ranges with expansion config) */
    const isExpandable = rangeType === "cell" && onToggleExpand !== undefined && expansionNodeId !== undefined;

    const sheetId = useMemo<number | undefined>(() => {
        return hfInstance.getSheetId(residingSheet);
    }, [hfInstance, residingSheet]);

    const sheetColorStyle = useMemo<React.CSSProperties>(() => {
        return getSheetColorStyle(sheetId ?? 0);
    }, [sheetId]);

    // For cell ranges: parse start and end addresses
    const simpleCellAddressStart = useMemo<SimpleCellAddress | undefined>(() => {
        if (rangeType !== "cell" || !data.startReference) return undefined;
        return hfInstance.simpleCellAddressFromString(data.startReference, sheetId || 0);
    }, [data, rangeType, hfInstance, sheetId]);

    const simpleCellAddressEnd = useMemo<SimpleCellAddress | undefined>(() => {
        if (rangeType !== "cell" || !data.endReference) return undefined;
        return hfInstance.simpleCellAddressFromString(data.endReference, sheetId || 0);
    }, [data, rangeType, hfInstance, sheetId]);

    // Calculate dimensions for cell ranges
    const numRows = useMemo<number>(() => {
        if (rangeType === "cell" && simpleCellAddressStart && simpleCellAddressEnd) {
            return Math.abs(simpleCellAddressStart.row - simpleCellAddressEnd.row) + 1;
        }
        if (rangeType === "row" && data.startRow !== undefined && data.endRow !== undefined) {
            return Math.abs(data.startRow - data.endRow) + 1;
        }
        return 0;
    }, [rangeType, simpleCellAddressStart, simpleCellAddressEnd, data]);


    // Get truncated cell values (only for cell ranges)
    // Note: No useMemo - we need fresh values on every render when cell values change
    let cellValuesTruncated: CellValue[] | undefined;
    if (rangeType !== "cell") {
        cellValuesTruncated = undefined;
    } else if (simpleCellAddressStart && simpleCellAddressEnd) {
        const VALUECAP = 1;
        const values: CellValue[] = [];
        const startRow = Math.min(simpleCellAddressStart.row, simpleCellAddressEnd.row);
        const startCol = Math.min(simpleCellAddressStart.col, simpleCellAddressEnd.col);
        const endRow = Math.max(simpleCellAddressStart.row, simpleCellAddressEnd.row);
        const endCol = Math.max(simpleCellAddressStart.col, simpleCellAddressEnd.col);
        for (let row = startRow, valueCount = 0; row <= endRow && valueCount < VALUECAP; row++) {
            for (let col = startCol; col <= endCol && valueCount < VALUECAP; col++) {
                try {
                    values.push(hfInstance.getCellValue({ col, row, sheet: sheetId || 0 }));
                } catch {
                    values.push('#REF!');
                }
                valueCount++;
            }
        }
        cellValuesTruncated = values;
    } else {
        cellValuesTruncated = undefined;
    }

    // Get header labels for cell ranges
    const { label: headerLabel } = useRangeHeaders(
        hfInstance,
        sheetId,
        simpleCellAddressStart?.row ?? 0,
        simpleCellAddressStart?.col ?? 0,
        simpleCellAddressEnd?.row ?? 0,
        simpleCellAddressEnd?.col ?? 0
    );

    // Double-click handler to enter edit mode for changing the range reference
    const handleDoubleClick = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();
        if (!isEditModeActive || !isThisNodeBeingEdited) {
            enterEditMode(id);
        }
    }, [enterEditMode, isEditModeActive, isThisNodeBeingEdited, id]);

    // Double-click handler for the value display - toggles cell grid expansion
    const handleValueDoubleClick = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();
        if (isExpandable && onToggleExpand && expansionNodeId) {
            onToggleExpand(expansionNodeId);
        }
    }, [isExpandable, onToggleExpand, expansionNodeId]);

    // Click handler - scrolls to the range location
    const handleClick = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();

        if (rangeType === "cell" && simpleCellAddressStart && simpleCellAddressEnd) {
            const startRow = Math.min(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const startCol = Math.min(simpleCellAddressStart.col, simpleCellAddressEnd.col);
            const endRow = Math.max(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const endCol = Math.max(simpleCellAddressStart.col, simpleCellAddressEnd.col);

            scrollToCell(startRow, startCol, residingSheet);
            highlightCells(startRow, startCol, endRow, endCol, residingSheet);
        } else if (rangeType === "column" && data.startColumn) {
            // Column range: scroll to row 1 of start column (e.g., C:D → C1)
            const col = hfInstance.simpleCellAddressFromString(`${data.startColumn}1`, sheetId || 0)?.col;
            if (col !== undefined) {
                scrollToCell(0, col, residingSheet);
            }
        } else if (rangeType === "row" && data.startRow !== undefined) {
            // Row range: scroll to column A of start row (e.g., 3:6 → A3)
            scrollToCell(data.startRow - 1, 0, residingSheet);
        }
    }, [rangeType, simpleCellAddressStart, simpleCellAddressEnd, scrollToCell, highlightCells, residingSheet, data, hfInstance, sheetId]);

    // Mouse over handler - only works for cell ranges
    const handleMouseOver = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();

        if (rangeType === "cell" && simpleCellAddressStart && simpleCellAddressEnd) {
            const startRow = Math.min(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const startCol = Math.min(simpleCellAddressStart.col, simpleCellAddressEnd.col);
            const endRow = Math.max(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const endCol = Math.max(simpleCellAddressStart.col, simpleCellAddressEnd.col);

            highlightCells(startRow, startCol, endRow, endCol, residingSheet);
        }
    }, [rangeType, simpleCellAddressStart, simpleCellAddressEnd, highlightCells, residingSheet]);

    // Save edit handler
    const handleSaveEdit = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();

        // Use astNodeIds array if available (for merged nodes), otherwise fall back to single astNodeId
        const nodeIds = astNodeIds ?? (astNodeId ? [astNodeId] : []);
        if (nodeIds.length === 0 || selectedRange === null) {
            exitEditMode();
            return;
        }

        const targetSheetId = hfInstance.getSheetId(activeSheetName);
        if (targetSheetId === undefined) {
            exitEditMode();
            return;
        }

        const { startRow, startCol, endRow, endCol } = selectedRange;

        switch (rangeType) {
            case 'cell': {
                // Convert indices to cell references using HyperFormula
                const startRef = hfInstance.simpleCellAddressToString(
                    { sheet: targetSheetId, row: startRow, col: startCol },
                    { includeSheetName: false }
                );
                const endRef = hfInstance.simpleCellAddressToString(
                    { sheet: targetSheetId, row: endRow, col: endCol },
                    { includeSheetName: false }
                );

                if (!startRef || !endRef) {
                    exitEditMode();
                    return;
                }

                saveEdit({
                    type: 'cellRange',
                    astNodeIds: nodeIds,
                    startReference: startRef,
                    endReference: endRef,
                    sheet: activeSheetName,
                    sourceCell,
                });
                break;
            }
            case 'column': {
                saveEdit({
                    type: 'columnRange',
                    astNodeIds: nodeIds,
                    startColumn: colIndexToLetter(startCol),
                    endColumn: colIndexToLetter(endCol),
                    sheet: activeSheetName,
                    sourceCell,
                });
                break;
            }
            case 'row': {
                saveEdit({
                    type: 'rowRange',
                    astNodeIds: nodeIds,
                    startRow: startRow + 1, // Convert to 1-indexed
                    endRow: endRow + 1,
                    sheet: activeSheetName,
                    sourceCell,
                });
                break;
            }
        }
    }, [astNodeId, astNodeIds, selectedRange, rangeType, activeSheetName, hfInstance, saveEdit, exitEditMode, sourceCell]);

    // Cancel edit handler
    const handleCancelEdit = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();
        exitEditMode();
    }, [exitEditMode]);

    /** Whether this node is merged (multiple occurrences combined into one) */
    const isMerged = Boolean(mergedRefKey);

    const handleUnmerge = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();
        if (mergedRefKey) {
            onUnmerge(mergedRefKey);
        }
    }, [mergedRefKey, onUnmerge]);

    // Generate the display label based on range type, with live preview during editing
    const rangeLabel = useMemo<{ start: string; end: string }>(() => {
        // If editing, show preview of selected range
        if (isThisNodeBeingEdited && selectedRange) {
            const targetSheetId = hfInstance.getSheetId(activeSheetName);
            if (targetSheetId !== undefined) {
                const { startRow, startCol, endRow, endCol } = selectedRange;

                switch (rangeType) {
                    case 'cell': {
                        const startRef = hfInstance.simpleCellAddressToString(
                            { sheet: targetSheetId, row: startRow, col: startCol },
                            { includeSheetName: false }
                        ) ?? '?';
                        const endRef = hfInstance.simpleCellAddressToString(
                            { sheet: targetSheetId, row: endRow, col: endCol },
                            { includeSheetName: false }
                        ) ?? '?';
                        return { start: startRef, end: endRef };
                    }
                    case 'column':
                        return {
                            start: colIndexToLetter(startCol),
                            end: colIndexToLetter(endCol)
                        };
                    case 'row':
                        return {
                            start: String(startRow + 1),
                            end: String(endRow + 1)
                        };
                }
            }
        }

        // Default: show current range values
        switch (rangeType) {
            case "cell":
                return {
                    start: data.startReference ?? "?",
                    end: data.endReference ?? "?"
                };
            case "column":
                return {
                    start: data.startColumn ?? "?",
                    end: data.endColumn ?? "?"
                };
            case "row":
                return {
                    start: String(data.startRow ?? "?"),
                    end: String(data.endRow ?? "?")
                };
            default:
                return { start: "?", end: "?" };
        }
    }, [rangeType, data, isThisNodeBeingEdited, selectedRange, hfInstance, activeSheetName]);

    // Generate value display based on range type
    const valueDisplay = useMemo<string>(() => {
        switch (rangeType) {
            case "cell":
                return cellValuesTruncated ? `${cellValuesTruncated},...` : "";
            case "column":
                return "column";
            case "row":
                return `${numRows} rows`;
            default:
                return "";
        }
    }, [rangeType, cellValuesTruncated, numRows]);

    // Compute the 2D grid of cell data for expanded view
    const cellGrid = useMemo<CellGridItem[][]>(() => {
        if (!isExpanded || rangeType !== "cell" || !simpleCellAddressStart || !simpleCellAddressEnd) {
            return [];
        }

        const startRow = Math.min(simpleCellAddressStart.row, simpleCellAddressEnd.row);
        const startCol = Math.min(simpleCellAddressStart.col, simpleCellAddressEnd.col);
        const endRow = Math.max(simpleCellAddressStart.row, simpleCellAddressEnd.row);
        const endCol = Math.max(simpleCellAddressStart.col, simpleCellAddressEnd.col);

        const grid: CellGridItem[][] = [];
        let cellCount = 0;

        for (let row = startRow; row <= endRow && cellCount < MAX_DISPLAYED_CELLS; row++) {
            const rowCells: CellGridItem[] = [];
            for (let col = startCol; col <= endCol && cellCount < MAX_DISPLAYED_CELLS; col++) {
                const address: SimpleCellAddress = { sheet: sheetId || 0, row, col };
                const ref = hfInstance.simpleCellAddressToString(address, { includeSheetName: false }) ?? '?';
                let value: CellValue;
                try {
                    value = hfInstance.getCellValue(address);
                } catch {
                    value = '#REF!';
                }
                const isEditable = typeof value === 'number' || typeof value === 'string';

                rowCells.push({
                    ref,
                    address,
                    value,
                    rawValue: typeof value === 'number' ? value : String(value ?? ""),
                    type: typeof value === 'number' ? 'number' : 'string',
                    isEditable,
                });
                cellCount++;
            }
            if (rowCells.length > 0) grid.push(rowCells);
        }

        return grid;
    }, [isExpanded, rangeType, simpleCellAddressStart, simpleCellAddressEnd, sheetId, hfInstance]);

    // Calculate total cells for truncation notice
    const totalCells = useMemo<number>(() => {
        if (rangeType !== "cell" || !simpleCellAddressStart || !simpleCellAddressEnd) {
            return 0;
        }
        const numRows = Math.abs(simpleCellAddressStart.row - simpleCellAddressEnd.row) + 1;
        const numCols = Math.abs(simpleCellAddressStart.col - simpleCellAddressEnd.col) + 1;
        return numRows * numCols;
    }, [rangeType, simpleCellAddressStart, simpleCellAddressEnd]);

    const hasMoreCells = totalCells > MAX_DISPLAYED_CELLS;

    // Handler for saving individual cell values in the expanded grid
    const handleCellSave = useCallback((address: SimpleCellAddress, value: string | number): void => {
        updateCell(value, address.row, address.col, residingSheet);
    }, [updateCell, residingSheet]);

    return (
        <div className={`node-wrapper ${isThisNodeBeingEdited ? 'editing' : ''} ${isExpanded ? 'expanded' : ''}`} style={sheetColorStyle}>
            <div className="selected-indicator"></div>
            <div
                className={`range-node ${rangeType !== "cell" ? "no-highlight" : ""}`}
                onClick={handleClick}
                onMouseOver={handleMouseOver}
                onMouseLeave={clearHighlight}
            >
                <div className="range-content">
                    <div className="range-left">
                        <div className="range-label-stack">
                            {rangeType === "cell" && headerLabel && (
                                <span className="header-label" title={headerLabel}>{headerLabel}</span>
                            )}
                            <span
                                className={`range-ref ${isThisNodeBeingEdited ? 'editing' : ''}`}
                                onDoubleClick={handleDoubleClick}
                                title="Double-click to change range"
                            >
                                <span>{rangeLabel.start}</span>
                                <span className="range-separator">:</span>
                                <span>{rangeLabel.end}</span>
                            </span>
                        </div>
                    </div>
                    <div className="range-right">
                        <span
                            className={`node-result-value ${isExpandable ? 'expandable' : ''}`}
                            onDoubleClick={isExpandable ? handleValueDoubleClick : undefined}
                            title={isExpandable ? (isExpanded ? "Double-click to collapse" : "Double-click to expand cells") : undefined}
                        >
                            {valueDisplay}
                        </span>
                        <Handle type="source" position={Position.Right} className="value-handle" />
                    </div>
                </div>
                {isThisNodeBeingEdited && (
                    <div className="edit-actions">
                        <button
                            className="edit-action-btn save-btn"
                            onClick={handleSaveEdit}
                            title="Save range change"
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
                {isExpanded && rangeType === "cell" && cellGrid.length > 0 && (
                    <div className="range-cell-grid">
                        {cellGrid.map((row, rowIdx) => (
                            <div key={rowIdx} className="range-cell-row">
                                {row.map((cell) => (
                                    <div key={cell.ref} className="range-cell-item">
                                        <span className="range-cell-ref">{cell.ref}</span>
                                        {cell.isEditable ? (
                                            <EditableConstant
                                                displayValue={String(cell.value ?? "")}
                                                rawValue={cell.rawValue}
                                                type={cell.type}
                                                editId={`${id}-cell-${cell.ref}`}
                                                className="range-cell-value"
                                                title="Double-click to edit"
                                                onSave={(value) => handleCellSave(cell.address, value)}
                                            />
                                        ) : (
                                            <span className="range-cell-value non-editable">{String(cell.value ?? "")}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                        {hasMoreCells && (
                            <div className="range-truncation-notice">
                                +{totalCells - MAX_DISPLAYED_CELLS} more cells
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
