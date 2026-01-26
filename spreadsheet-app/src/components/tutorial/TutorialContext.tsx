import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode, type JSX } from 'react';
import { TutorialOverlay } from './TutorialOverlay';

/**
 * Action to automatically select a cell when entering a tutorial step
 */
export interface SelectCellAction {
    type: 'selectCell';
    /** Zero-indexed row number */
    row: number;
    /** Zero-indexed column number */
    col: number;
    /** Optional sheet name (switches sheet if different from current) */
    sheet?: string;
}

/**
 * Union type for all tutorial actions
 */
export type TutorialAction = SelectCellAction;

/**
 * Represents a single step in the tutorial
 */
export interface TutorialStep {
    /** Unique identifier for the step */
    id: string;
    /** CSS selector to target the element (e.g., '[data-tutorial="flow-graph"]') */
    targetSelector: string;
    /** Title displayed in the tooltip */
    title: string;
    /** Description/instruction text */
    content: string;
    /** Tooltip position relative to target element */
    position: 'top' | 'bottom' | 'left' | 'right';
    /** Optional action to execute when entering this step */
    action?: TutorialAction;
    /** Block interaction with the spreadsheet during this step */
    blockSpreadsheet?: boolean;
    /** CSS selector for element user must click to proceed (hides Next button) */
    awaitClick?: string;
}

/**
 * Context value for managing the tutorial state
 */
export interface TutorialContextValue {
    /** Whether the tutorial is currently active */
    isActive: boolean;
    /** The current step being displayed, or null if inactive */
    currentStep: TutorialStep | null;
    /** Zero-based index of the current step */
    currentStepIndex: number;
    /** Total number of steps in the tutorial */
    totalSteps: number;
    /**
     * Starts the tutorial with the given steps
     * @param steps - Array of tutorial steps to display
     */
    startTutorial: (steps: TutorialStep[]) => Promise<void>;
    /** Advances to the next step, or ends the tutorial if on the last step */
    nextStep: () => void;
    /** Goes back to the previous step */
    prevStep: () => void;
    /** Exits the tutorial immediately */
    skipTutorial: () => void;
    /**
     * Jumps to a specific step by index
     * @param index - The step index to go to
     */
    goToStep: (index: number) => void;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

/**
 * Props for TutorialProvider
 */
interface TutorialProviderProps {
    children: ReactNode;
    /** Callback to select a cell in the spreadsheet (optionally switching sheets) */
    selectCell?: (row: number, col: number, sheet?: string) => void;
    /** Callback to reset app state when tutorial starts (clear selection, switch to first sheet) */
    onReset?: () => Promise<void> | void;
}

/**
 * Provider component for the tutorial system.
 * Manages tutorial state and renders the overlay when active.
 */
export function TutorialProvider({ children, selectCell, onReset }: TutorialProviderProps): JSX.Element {
    const [isActive, setIsActive] = useState(false);
    const [steps, setSteps] = useState<TutorialStep[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    /** Track which step's action has been executed to prevent re-execution */
    const executedActionIndexRef = useRef<number>(-1);

    const startTutorial = useCallback(async (tutorialSteps: TutorialStep[]): Promise<void> => {
        if (tutorialSteps.length === 0) return;
        // Reset app state to clean slate before starting tutorial (wait for async reset)
        await onReset?.();
        executedActionIndexRef.current = -1; // Reset action tracking
        setSteps(tutorialSteps);
        setCurrentIndex(0);
        setIsActive(true);
    }, [onReset]);

    const nextStep = useCallback(() => {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // End tutorial on last step
            setIsActive(false);
            setCurrentIndex(0);
        }
    }, [currentIndex, steps.length]);

    const prevStep = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const skipTutorial = useCallback(() => {
        setIsActive(false);
        setCurrentIndex(0);
    }, []);

    const goToStep = useCallback((index: number) => {
        if (index >= 0 && index < steps.length) {
            setCurrentIndex(index);
        }
    }, [steps.length]);

    // Execute step actions when step changes (only once per step)
    useEffect(() => {
        if (!isActive || steps.length === 0) return;
        // Prevent re-execution if we've already executed this step's action
        if (executedActionIndexRef.current === currentIndex) return;

        const currentStep = steps[currentIndex];
        if (!currentStep?.action) return;

        const { action } = currentStep;
        if (action.type === 'selectCell' && selectCell) {
            executedActionIndexRef.current = currentIndex;
            selectCell(action.row, action.col, action.sheet);
        }
    }, [isActive, steps, currentIndex, selectCell]);

    // Listen for clicks on awaitClick element to auto-advance
    useEffect(() => {
        if (!isActive || steps.length === 0) return;

        const currentStep = steps[currentIndex];
        if (!currentStep?.awaitClick) return;

        const handleClick = (): void => {
            // Small delay to let the click action complete first
            setTimeout(() => {
                if (currentIndex < steps.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                } else {
                    setIsActive(false);
                    setCurrentIndex(0);
                }
            }, 100);
        };

        const element = document.querySelector(currentStep.awaitClick);
        if (element) {
            element.addEventListener('click', handleClick);
            return () => element.removeEventListener('click', handleClick);
        }
    }, [isActive, steps, currentIndex]);

    const value: TutorialContextValue = useMemo(() => ({
        isActive,
        currentStep: isActive && steps.length > 0 ? steps[currentIndex] : null,
        currentStepIndex: currentIndex,
        totalSteps: steps.length,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        goToStep,
    }), [isActive, steps, currentIndex, startTutorial, nextStep, prevStep, skipTutorial, goToStep]);

    return (
        <TutorialContext.Provider value={value}>
            {children}
            {isActive && <TutorialOverlay />}
        </TutorialContext.Provider>
    );
}

/**
 * Hook to access tutorial functionality
 * @throws Error if used outside of TutorialProvider
 */
export function useTutorial(): TutorialContextValue {
    const context = useContext(TutorialContext);
    if (context === undefined) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
}

export { TutorialContext };
