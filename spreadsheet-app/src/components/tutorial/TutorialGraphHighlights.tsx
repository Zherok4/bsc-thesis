import { type JSX } from 'react';
import { useTutorial } from './TutorialContext';
import { useGraphNodeHighlights } from './hooks/useGraphNodeHighlights';
import './Tutorial.css';

/**
 * Standalone component that renders highlight overlays on graph nodes during tutorial.
 * Reads the current step's graphHighlight config from TutorialContext and renders
 * highlight rings around matching nodes.
 *
 * This component is independent and can be rendered anywhere in the component tree
 * as long as it's within a TutorialProvider.
 */
export function TutorialGraphHighlights(): JSX.Element | null {
    const { currentStep, isActive } = useTutorial();
    const { highlightedNodes, mode } = useGraphNodeHighlights(
        isActive ? currentStep?.graphHighlight ?? null : null
    );

    if (!isActive || !currentStep?.graphHighlight || highlightedNodes.length === 0) {
        return null;
    }

    const padding = 4;
    const borderRadius = 8;

    return (
        <>
            {highlightedNodes.map(({ id, rect }) => (
                <div
                    key={id}
                    className={`tutorial-node-highlight tutorial-node-highlight-${mode}`}
                    style={{
                        left: rect.left - padding,
                        top: rect.top - padding,
                        width: rect.width + padding * 2,
                        height: rect.height + padding * 2,
                        borderRadius: borderRadius,
                    }}
                />
            ))}
        </>
    );
}
