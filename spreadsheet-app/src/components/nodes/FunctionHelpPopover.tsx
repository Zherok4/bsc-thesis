import type { JSX } from 'react';
import type { HyperFormula } from 'hyperformula';
import { generateFunctionDescription } from '../../data/functionDescriptions';
import { Popover } from './Popover';
import './FunctionHelpPopover.css';

/**
 * Props for the FunctionHelpPopover component
 */
interface FunctionHelpPopoverProps {
    /** The function name (e.g., "SUM", "VLOOKUP") */
    functionName: string;
    /** Array of argument formula strings */
    argFormulas: string[];
    /** HyperFormula instance for evaluating nested formulas */
    hfInstance: HyperFormula | null;
    /** Sheet name for context when evaluating */
    sheet: string;
    /** Callback when the popover should close */
    onClose: () => void;
}

/**
 * A popover that displays a generated description of what a function does.
 * Uses the base Popover component for positioning and dismissal.
 * Simplifies nested formulas by evaluating them (e.g., "SUM(A1:A10) > 5" becomes "171 > 5").
 */
export function FunctionHelpPopover({
    functionName,
    argFormulas,
    hfInstance,
    sheet,
    onClose,
}: FunctionHelpPopoverProps): JSX.Element {
    const description = generateFunctionDescription(functionName, argFormulas, hfInstance, sheet);

    return (
        <Popover position="below" onClose={onClose} className="function-help-popover">
            <p className="function-help-text">{description}</p>
        </Popover>
    );
}
