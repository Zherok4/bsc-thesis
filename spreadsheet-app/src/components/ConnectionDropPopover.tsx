import { useEffect, useRef, useState, useLayoutEffect, type JSX } from 'react';
import './ConnectionDropPopover.css';

/**
 * Props for the ConnectionDropPopover component
 */
interface ConnectionDropPopoverProps {
    /** ID of the target node (for positioning relative to handle) */
    targetNodeId: string;
    /** ID of the target handle (for positioning relative to handle) */
    targetHandle: string;
    /** Callback when user chooses to replace the existing connection */
    onReplace: () => void;
    /** Callback when user chooses to swap the connections */
    onSwap: () => void;
    /** Callback when user cancels (click outside or Escape) */
    onCancel: () => void;
}

/**
 * A floating popover that appears when dropping a connection on an occupied handle.
 * Offers two options: Replace (default behavior) or Swap (exchange the two connections).
 * Positions itself relative to the target handle so it stays in place when panning.
 */
export function ConnectionDropPopover({
    targetNodeId,
    targetHandle,
    onReplace,
    onSwap,
    onCancel,
}: ConnectionDropPopoverProps): JSX.Element {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

    // Find the handle element and position relative to it
    // Use requestAnimationFrame loop to continuously track position during any viewport change
    useLayoutEffect(() => {
        let rafId: number;
        let isRunning = true;

        const updatePosition = (): void => {
            // Find the target handle element
            const nodeElement = document.querySelector(`[data-id="${targetNodeId}"]`);
            if (!nodeElement) {
                if (isRunning) rafId = requestAnimationFrame(updatePosition);
                return;
            }

            const handleElement = nodeElement.querySelector(
                `.react-flow__handle[data-handleid="${targetHandle}"]`
            );
            if (!handleElement) {
                if (isRunning) rafId = requestAnimationFrame(updatePosition);
                return;
            }

            const handleRect = handleElement.getBoundingClientRect();

            // Position above the handle, centered
            setPosition(prev => {
                const newX = handleRect.left + handleRect.width / 2;
                const newY = handleRect.top;
                // Only update if position actually changed to avoid unnecessary re-renders
                if (prev && Math.abs(prev.x - newX) < 0.5 && Math.abs(prev.y - newY) < 0.5) {
                    return prev;
                }
                return { x: newX, y: newY };
            });

            // Continue the loop
            if (isRunning) {
                rafId = requestAnimationFrame(updatePosition);
            }
        };

        // Start the animation loop
        rafId = requestAnimationFrame(updatePosition);

        return () => {
            isRunning = false;
            cancelAnimationFrame(rafId);
        };
    }, [targetNodeId, targetHandle]);

    // Handle click outside to cancel
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onCancel();
            }
        };

        // Handle Escape key to cancel
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onCancel();
            }
        };

        // Add listeners with a small delay to avoid immediate trigger from the drop event
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }, 50);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onCancel]);

    // Focus the popover on mount for keyboard accessibility
    useEffect(() => {
        popoverRef.current?.focus();
    }, []);

    // Don't render until we have a position
    if (!position) return <></>;

    return (
        <div
            ref={popoverRef}
            className="connection-drop-popover"
            style={{
                left: position.x,
                top: position.y,
            }}
            tabIndex={-1}
        >
            <div className="connection-drop-popover-content">
                <span className="connection-drop-popover-label">Handle occupied</span>
                <div className="connection-drop-popover-actions">
                    <button
                        className="connection-drop-btn replace-btn"
                        onClick={onReplace}
                        type="button"
                    >
                        Replace
                    </button>
                    <button
                        className="connection-drop-btn swap-btn"
                        onClick={onSwap}
                        type="button"
                    >
                        Swap
                    </button>
                </div>
            </div>
        </div>
    );
}
