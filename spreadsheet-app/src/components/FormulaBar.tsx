import './FormulaBar.css';

const FormulaBar = () => {
    return (
        <div className="formula-bar">
            <div className="formula-bar__fx-button">
                fx
            </div>
            <input
                type="text"
                className="formula-bar__input"
                placeholder=""
                readOnly
            />
        </div>
    );
}

export default FormulaBar;
