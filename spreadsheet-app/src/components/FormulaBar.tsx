import './FormulaBar.css';
import { useCallback, useRef } from 'react';

interface FormulaBarProps {
    value: string;
    onChange: (newValue: string) => void;
    onEnterPress: () => void;
}

const FormulaBar = ({value, onChange, onEnterPress}: FormulaBarProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    // TODO: add Escape key handler, formulas are only commited after enter ==> i.e while typing no errors should be displayed
    const handleOnKeyDown = useCallback((key: string) => {
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
