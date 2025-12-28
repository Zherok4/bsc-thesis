import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useCallback, useMemo, type JSX } from "react";
import { useHyperFormula, type HyperFormulaContextValue } from "../context";
import { type CellValue, type SimpleCellAddress } from "hyperformula";
import { getSheetColorStyle } from "../../utils/sheetColors";
import "./RangeNode.css"

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
    /** Optional sheet name */
    sheet?: string;
},
'RangeNode'
>;

/**
 * Component that renders cell ranges, column ranges, and row ranges
 */
export default function RangeNodeComponent({ data }: NodeProps<RangeNode>): JSX.Element {
    const { hfInstance, activeSheetName, scrollToCell, highlightCells, clearHighlight }: HyperFormulaContextValue = useHyperFormula();

    const sheet = data.sheet;
    const rangeType = data.rangeType ?? "cell"; // Default to cell for backwards compatibility

    const residingSheet = useMemo<string>(() => {
        return activeSheetName;
    }, []);

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

    const numCols = useMemo<number>(() => {
        if (rangeType === "cell" && simpleCellAddressStart && simpleCellAddressEnd) {
            return Math.abs(simpleCellAddressStart.col - simpleCellAddressEnd.col) + 1;
        }
        // For column ranges, we'd need to parse column letters to numbers
        return 0;
    }, [rangeType, simpleCellAddressStart, simpleCellAddressEnd]);

    // Get truncated cell values (only for cell ranges)
    const cellValuesTruncated = useMemo<CellValue[] | undefined>(() => {
        if (rangeType !== "cell") return undefined;
        const VALUECAP = 1;
        const values: CellValue[] = [];
        if (simpleCellAddressStart && simpleCellAddressEnd) {
            const startRow = Math.min(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const startCol = Math.min(simpleCellAddressStart.col, simpleCellAddressEnd.col);
            const endRow = Math.max(simpleCellAddressStart.row, simpleCellAddressEnd.row);
            const endCol = Math.max(simpleCellAddressStart.col, simpleCellAddressEnd.col);
            for (let row = startRow, valueCount = 0; row <= endRow && valueCount < VALUECAP; row++) {
                for (let col = startCol; col <= endCol && valueCount < VALUECAP; col++) {
                    values.push(hfInstance.getCellValue({ col, row, sheet: sheetId || 0 }));
                    valueCount++;
                }
            }
            return values;
        }
        return undefined;
    }, [rangeType, simpleCellAddressStart, simpleCellAddressEnd, hfInstance, sheetId]);

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

    // Generate the display label based on range type
    const rangeLabel = useMemo<{ start: string; end: string }>(() => {
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
    }, [rangeType, data]);

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

    return (
        <div className="node-wrapper" style={sheetColorStyle}>
            <div className="selected-indicator"></div>
            <div
                className={`range-node ${rangeType !== "cell" ? "no-highlight" : ""}`}
                onClick={handleClick}
                onMouseOver={handleMouseOver}
                onMouseLeave={clearHighlight}
            >
                <div className="range-content">
                    <div className="range-left">
                        <span className="range-ref">
                            <span>{rangeLabel.start}</span>
                            <span className="range-separator">:</span>
                            <span>{rangeLabel.end}</span>
                        </span>
                    </div>
                    <div className="range-right">
                        <span className="node-result-value">{valueDisplay}</span>
                        <Handle type="source" position={Position.Right} className="value-handle" />
                    </div>
                </div>
            </div>
        </div>
    );
}
