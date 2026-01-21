import './Minimap.css';
import type { JSX } from 'react';
import type { ViewportInfo } from './Datatable';

/**
 * Props for the Minimap component
 */
interface MinimapProps {
    /** Current viewport information */
    viewport: ViewportInfo | null;
    /** Controls visibility (fade in/out) */
    visible: boolean;
    /** Width of the minimap in pixels */
    width?: number;
    /** Height of the minimap in pixels */
    height?: number;
}

/**
 * Visual representation of the visible viewport within the total worksheet area.
 * Gray box represents the full sheet, white box shows the currently visible portion.
 *
 * @param props - Component props
 */
const Minimap = ({
    viewport,
    visible,
    width = 60,
    height = 24
}: MinimapProps): JSX.Element => {
    if (!viewport) {
        return (
            <div
                className={`minimap ${visible ? 'minimap--visible' : ''}`}
                style={{ width, height }}
            >
                <div className="minimap__total" />
            </div>
        );
    }

    const {
        firstVisibleRow,
        lastVisibleRow,
        firstVisibleCol,
        lastVisibleCol,
        totalRows,
        totalCols
    } = viewport;

    // Calculate proportions (avoid division by zero)
    const widthRatio = totalCols > 0
        ? (lastVisibleCol - firstVisibleCol + 1) / totalCols
        : 1;
    const heightRatio = totalRows > 0
        ? (lastVisibleRow - firstVisibleRow + 1) / totalRows
        : 1;
    const leftRatio = totalCols > 0 ? firstVisibleCol / totalCols : 0;
    const topRatio = totalRows > 0 ? firstVisibleRow / totalRows : 0;

    // Calculate pixel positions within the minimap
    const viewportLeft = leftRatio * width;
    const viewportTop = topRatio * height;
    const viewportWidth = Math.max(2, widthRatio * width);
    const viewportHeight = Math.max(2, heightRatio * height);

    return (
        <div
            className={`minimap ${visible ? 'minimap--visible' : ''}`}
            style={{ width, height }}
            title={`Rows ${firstVisibleRow + 1}-${lastVisibleRow + 1} of ${totalRows}, Cols ${firstVisibleCol + 1}-${lastVisibleCol + 1} of ${totalCols}`}
        >
            <div className="minimap__total">
                <div
                    className="minimap__viewport"
                    style={{
                        left: viewportLeft,
                        top: viewportTop,
                        width: viewportWidth,
                        height: viewportHeight,
                    }}
                />
            </div>
        </div>
    );
};

export default Minimap;
