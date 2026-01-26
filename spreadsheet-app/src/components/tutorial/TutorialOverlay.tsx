import { useState, useEffect, type JSX } from 'react';
import { useTutorial } from './TutorialContext';
import { useTutorialHighlight } from './hooks/useTutorialHighlight';
import { TutorialTooltip } from './TutorialTooltip';
import './Tutorial.css';

/**
 * Full-screen overlay component that creates a spotlight effect around the target element.
 * Renders when the tutorial is active.
 */
export function TutorialOverlay(): JSX.Element | null {
    const { currentStep, nextStep, prevStep, skipTutorial, currentStepIndex, totalSteps } = useTutorial();
    const { targetRect } = useTutorialHighlight(currentStep?.targetSelector ?? null);
    const [spreadsheetRect, setSpreadsheetRect] = useState<DOMRect | null>(null);

    // Track spreadsheet element position for blocking overlay
    useEffect(() => {
        if (!currentStep?.blockSpreadsheet) {
            setSpreadsheetRect(null);
            return;
        }

        const updateRect = (): void => {
            const element = document.querySelector('[data-tutorial="spreadsheet"]');
            if (element) {
                setSpreadsheetRect(element.getBoundingClientRect());
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
        };
    }, [currentStep?.blockSpreadsheet]);

    if (!currentStep) return null;

    // Padding around the spotlight
    const padding = 8;
    const borderRadius = 8;

    return (
        <div className="tutorial-overlay">
            {/* SVG backdrop with spotlight cutout */}
            <svg className="tutorial-backdrop" width="100%" height="100%">
                <defs>
                    <mask id="tutorial-spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left - padding}
                                y={targetRect.top - padding}
                                width={targetRect.width + padding * 2}
                                height={targetRect.height + padding * 2}
                                rx={borderRadius}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.5)"
                    mask="url(#tutorial-spotlight-mask)"
                />
            </svg>

            {/* Highlight ring around target */}
            {targetRect && (
                <div
                    className="tutorial-highlight-ring"
                    style={{
                        left: targetRect.left - padding,
                        top: targetRect.top - padding,
                        width: targetRect.width + padding * 2,
                        height: targetRect.height + padding * 2,
                        borderRadius: borderRadius,
                    }}
                />
            )}

            {/* Blocking overlay for spreadsheet when step requires it */}
            {currentStep.blockSpreadsheet && spreadsheetRect && (
                <div
                    className="tutorial-spreadsheet-blocker"
                    style={{
                        position: 'fixed',
                        left: spreadsheetRect.left,
                        top: spreadsheetRect.top,
                        width: spreadsheetRect.width,
                        height: spreadsheetRect.height,
                        pointerEvents: 'all',
                        cursor: 'not-allowed',
                    }}
                />
            )}

            {/* Tooltip */}
            <TutorialTooltip
                step={currentStep}
                targetRect={targetRect}
                stepNumber={currentStepIndex + 1}
                totalSteps={totalSteps}
                onNext={nextStep}
                onPrev={prevStep}
                onSkip={skipTutorial}
                canGoPrev={currentStepIndex > 0}
                isLastStep={currentStepIndex === totalSteps - 1}
            />
        </div>
    );
}
