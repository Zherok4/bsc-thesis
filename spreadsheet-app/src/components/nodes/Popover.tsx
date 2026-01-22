import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import './Popover.css';

/**
 * Position of the popover relative to its anchor
 */
export type PopoverPosition = 'above' | 'below';

/**
 * Props for the base Popover component
 */
export interface PopoverProps {
    /** Content to render inside the popover */
    children: ReactNode;
    /** Position relative to anchor - 'above' or 'below' */
    position?: PopoverPosition;
    /** Callback when the popover should close (click outside or Escape) */
    onClose: () => void;
    /** Optional additional CSS class */
    className?: string;
}

/**
 * A reusable base popover component that handles positioning, dismissal, and styling.
 * Uses absolute positioning within the parent (follows EditableConstant pattern).
 * The parent node should have `position: relative` set.
 *
 * To ensure the popover appears above other nodes, add this CSS rule:
 * `.react-flow__node:has(.popover) { z-index: 10000 !important; }`
 */
export function Popover({
    children,
    position = 'below',
    onClose,
    className = '',
}: PopoverProps): JSX.Element {
    const popoverRef = useRef<HTMLDivElement>(null);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Handle Escape key to close
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        // Add listeners with a small delay to avoid immediate trigger from click event
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }, 50);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Focus the popover on mount for keyboard accessibility
    useEffect(() => {
        popoverRef.current?.focus();
    }, []);

    return (
        <div
            ref={popoverRef}
            className={`popover popover-${position} ${className}`}
            tabIndex={-1}
        >
            <div className="popover-content">
                {children}
            </div>
        </div>
    );
}
