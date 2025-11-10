import './FormulaBar.css';
interface FormulaBarProps {
    value: string;
}

const FormulaBar = ({value}: FormulaBarProps) => {
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
            />
        </div>
    );
}

export default FormulaBar;
