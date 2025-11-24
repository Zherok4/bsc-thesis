import './TopBar.css';

const TopBar = () => {
    return (
        <div className="top-bar">
            <button
                className="top-bar__import-button"
                onClick={() => {/* No functionality yet */}}
            >
                Import File
            </button>
        </div>
    );
}

export default TopBar;
