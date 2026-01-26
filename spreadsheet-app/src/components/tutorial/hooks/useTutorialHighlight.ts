import { useState, useEffect, useCallback } from 'react';

/**
 * Result of the useTutorialHighlight hook
 */
export interface TutorialHighlightResult {
    /** Bounding rectangle of the target element, or null if not found */
    targetRect: DOMRect | null;
    /** The target DOM element, or null if not found */
    targetElement: Element | null;
    /** Forces a recalculation of the target position */
    updatePosition: () => void;
}

/**
 * Hook to track and highlight a DOM element for the tutorial.
 * Handles element lookup, position tracking, and scroll-into-view.
 *
 * @param targetSelector - CSS selector to find the target element, or null to clear
 * @returns Object containing the target rect, element, and update function
 */
export function useTutorialHighlight(targetSelector: string | null): TutorialHighlightResult {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [targetElement, setTargetElement] = useState<Element | null>(null);

    const updatePosition = useCallback(() => {
        if (!targetSelector) {
            setTargetRect(null);
            setTargetElement(null);
            return;
        }

        const element = document.querySelector(targetSelector);
        if (element) {
            setTargetElement(element);
            setTargetRect(element.getBoundingClientRect());
        } else {
            setTargetElement(null);
            setTargetRect(null);
        }
    }, [targetSelector]);

    useEffect(() => {
        if (!targetSelector) {
            setTargetRect(null);
            setTargetElement(null);
            return;
        }

        // Initial lookup with a small delay to ensure DOM is ready
        const initialTimeout = setTimeout(() => {
            const element = document.querySelector(targetSelector);
            if (element) {
                setTargetElement(element);
                setTargetRect(element.getBoundingClientRect());

                // Scroll element into view if needed
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            } else {
                setTargetElement(null);
                setTargetRect(null);
            }
        }, 50);

        // Update position on resize and scroll
        const handleUpdate = (): void => {
            const element = document.querySelector(targetSelector);
            if (element) {
                setTargetRect(element.getBoundingClientRect());
            }
        };

        window.addEventListener('resize', handleUpdate);
        window.addEventListener('scroll', handleUpdate, true);

        return () => {
            clearTimeout(initialTimeout);
            window.removeEventListener('resize', handleUpdate);
            window.removeEventListener('scroll', handleUpdate, true);
        };
    }, [targetSelector]);

    return { targetRect, targetElement, updatePosition };
}
