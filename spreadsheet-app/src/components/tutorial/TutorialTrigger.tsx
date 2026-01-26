import type { JSX } from 'react';
import { TUTORIAL_ENABLED } from '../../tutorial/config';
import { useTutorial } from './TutorialContext';
import { graphTutorialSteps } from './steps/graphTutorialSteps';

/**
 * Tutorial button component that triggers the tutorial.
 * Renders in the TopBar next to the import button.
 * Returns null if tutorial is disabled or already active.
 */
export function TutorialTrigger(): JSX.Element | null {
    const { startTutorial, isActive } = useTutorial();

    // Don't render if disabled or already running
    if (!TUTORIAL_ENABLED || isActive) {
        return null;
    }

    const handleClick = (): void => {
        startTutorial(graphTutorialSteps);
    };

    return (
        <button
            className="top-bar__import-button"
            onClick={handleClick}
            title="Start tutorial"
            aria-label="Start tutorial"
            type="button"
        >
            Tutorial
        </button>
    );
}
