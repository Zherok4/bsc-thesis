import './FormulaBar.css';
import { useCallback, useRef, type JSX } from 'react';

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
}

/**
 * Formula bar component for editing cell values and formulas.
 * Displays an "fx" indicator and a text input for formula entry.
 *
 * @param props - Component props
 * @param props.value - Current cell value or formula
 * @param props.onChange - Handler for value changes
 * @param props.onEnterPress - Handler for Enter key to commit changes
 */
const FormulaBar = ({value, onChange, onEnterPress}: FormulaBarProps): JSX.Element => {
    const inputRef = useRef<HTMLInputElement>(null);

    // TODO: add Escape key handler, formulas are only commited after enter ==> i.e while typing no errors should be displayed
    const handleOnKeyDown = useCallback((key: string): void => {
        if (key === "Enter") {
            inputRef.current?.blur();
            onEnterPress();
        }
    }, [onEnterPress]);

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
                value = {value}
                onChange = {(e) => onChange(e.target.value)}
                onKeyDown= {(e) => handleOnKeyDown(e.key)}
            />
        </div>
    );
}

export default FormulaBar;
