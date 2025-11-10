import './FormulaBar.css';
interface FormulaBarProps {
    value: string;
    handleOnChange: (newValue: string) => void; 
}
// TODO: after onChange let new Value be propogated back to the cell
const FormulaBar = ({value, handleOnChange}: FormulaBarProps) => {
    return (
        <div className="formula-bar">
            <div className="formula-bar__fx-button">
                fx
            </div>
            <input
                type="text"
                className="formula-bar__input"
                placeholder=""
                value = {value}
                onChange = {(e) => handleOnChange(e.target.value)}
            />
        </div>
    );
}

export default FormulaBar;
