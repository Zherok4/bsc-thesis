import './FormulaBar.css';
import { useCallback, useRef, useState, type JSX } from 'react';

/**
 * Props for the FormulaBar component
 */
interface FormulaBarProps {
    /** Current value displayed in the formula input */
    value: string;
    /** Callback invoked when the input value changes */
    onChange: (newValue: string) => void;
    /** Callback invoked when Enter key is pressed */
    onEnterPress: () => void;
    /** Callback invoked when Escape key is pressed to cancel editing */
    onCancel?: (originalValue: string) => void;
}

/**
 * Formula bar component for editing cell values and formulas.
 * Displays an "fx" indicator and a text input for formula entry.
 *
 * - Enter: Commits the changes and moves selection down
 * - Escape: Cancels editing and restores the original value
 *
 * @param props - Component props
 * @param props.value - Current cell value or formula
 * @param props.onChange - Handler for value changes
 * @param props.onEnterPress - Handler for Enter key to commit changes
 * @param props.onCancel - Handler for Escape key to cancel changes
 */
const FormulaBar = ({value, onChange, onEnterPress, onCancel}: FormulaBarProps): JSX.Element => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [valueOnFocus, setValueOnFocus] = useState<string>('');

    const handleOnFocus = useCallback((): void => {
        setValueOnFocus(value);
    }, [value]);

    const handleOnKeyDown = useCallback((key: string): void => {
        if (key === "Enter") {
            inputRef.current?.blur();
            onEnterPress();
        } else if (key === "Escape") {
            // Restore original value and blur
            onChange(valueOnFocus);
            onCancel?.(valueOnFocus);
            inputRef.current?.blur();
        }
    }, [onEnterPress, onChange, onCancel, valueOnFocus]);

    return (
        <div className="formula-bar">
            <div className="formula-bar__fx-button">
                fx
            </div>
            <input
                ref={inputRef}
                type="text"
                className="formula-bar__input"
                placeholder=""
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={handleOnFocus}
                onKeyDown={(e) => handleOnKeyDown(e.key)}
            />
        </div>
    );
}

export default FormulaBar;
