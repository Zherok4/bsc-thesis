import { useEffect, useCallback, type JSX } from 'react';
import type { TutorialStep } from './TutorialContext';
import './Tutorial.css';

/**
 * Props for the TutorialTooltip component
 */
interface TutorialTooltipProps {
    /** The current tutorial step */
    step: TutorialStep;
    /** Bounding rect of the target element, or null if not found */
    targetRect: DOMRect | null;
    /** Current step number (1-based for display) */
    stepNumber: number;
    /** Total number of steps */
    totalSteps: number;
    /** Callback for next button */
    onNext: () => void;
    /** Callback for previous button */
    onPrev: () => void;
    /** Callback for skip button */
    onSkip: () => void;
    /** Whether the previous button should be enabled */
    canGoPrev: boolean;
    /** Whether this is the last step */
    isLastStep: boolean;
}

/** Tooltip offset from target element */
const TOOLTIP_OFFSET = 16;
/** Tooltip dimensions for positioning calculations */
const TOOLTIP_WIDTH = 300;
const TOOLTIP_HEIGHT_ESTIMATE = 150;

/**
 * Calculates tooltip position based on target rect and desired position.
 */
function calculateTooltipPosition(
    targetRect: DOMRect | null,
    position: TutorialStep['position']
): { top: number; left: number } {
    if (!targetRect) {
        // Center of screen if no target
        return {
            top: window.innerHeight / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2,
            left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
        };
    }

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    switch (position) {
        case 'top':
            return {
                top: targetRect.top - TOOLTIP_HEIGHT_ESTIMATE - TOOLTIP_OFFSET,
                left: targetCenterX - TOOLTIP_WIDTH / 2,
            };
        case 'bottom':
            return {
                top: targetRect.bottom + TOOLTIP_OFFSET,
                left: targetCenterX - TOOLTIP_WIDTH / 2,
            };
        case 'left':
            return {
                top: targetCenterY - TOOLTIP_HEIGHT_ESTIMATE / 2,
                left: targetRect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET,
            };
        case 'right':
            return {
                top: targetCenterY - TOOLTIP_HEIGHT_ESTIMATE / 2,
                left: targetRect.right + TOOLTIP_OFFSET,
            };
        default:
            return {
                top: targetRect.bottom + TOOLTIP_OFFSET,
                left: targetCenterX - TOOLTIP_WIDTH / 2,
            };
    }
}

/**
 * Clamps position to keep tooltip within viewport bounds.
 */
function clampPosition(pos: { top: number; left: number }): { top: number; left: number } {
    const margin = 16;
    return {
        top: Math.max(margin, Math.min(pos.top, window.innerHeight - TOOLTIP_HEIGHT_ESTIMATE - margin)),
        left: Math.max(margin, Math.min(pos.left, window.innerWidth - TOOLTIP_WIDTH - margin)),
    };
}

/**
 * Tooltip component displaying tutorial step content with navigation.
 */
export function TutorialTooltip({
    step,
    targetRect,
    stepNumber,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
    canGoPrev,
    isLastStep,
}: TutorialTooltipProps): JSX.Element {
    // Whether this step requires clicking a specific element
    const requiresClick = Boolean(step.awaitClick);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        switch (e.key) {
            case 'Escape':
                onSkip();
                break;
            case 'ArrowRight':
            case 'Enter':
                // Don't allow keyboard navigation if step requires clicking an element
                if (!requiresClick) onNext();
                break;
            case 'ArrowLeft':
                if (canGoPrev) onPrev();
                break;
        }
    }, [onNext, onPrev, onSkip, canGoPrev, requiresClick]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const position = clampPosition(calculateTooltipPosition(targetRect, step.position));

    return (
        <div
            className="tutorial-tooltip"
            style={{
                top: position.top,
                left: position.left,
                width: TOOLTIP_WIDTH,
            }}
        >
            <div className="tutorial-tooltip-header">
                <h3 className="tutorial-tooltip-title">{step.title}</h3>
                <span className="tutorial-tooltip-step">{stepNumber} / {totalSteps}</span>
            </div>

            <p className="tutorial-tooltip-content">{step.content}</p>

            <div className="tutorial-controls">
                <button
                    className="tutorial-btn tutorial-btn-skip"
                    onClick={onSkip}
                    type="button"
                >
                    Skip
                </button>

                <div className="tutorial-controls-nav">
                    {canGoPrev && (
                        <button
                            className="tutorial-btn tutorial-btn-secondary"
                            onClick={onPrev}
                            type="button"
                        >
                            Previous
                        </button>
                    )}
                    {!requiresClick && (
                        <button
                            className="tutorial-btn tutorial-btn-primary"
                            onClick={onNext}
                            type="button"
                        >
                            {isLastStep ? 'Finish' : 'Next'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
