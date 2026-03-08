import { useState, useRef, useEffect, type JSX } from 'react';
import './CreditsButton.css';

/**
 * Button that shows a dropdown with icon attribution credits.
 * Closes on outside click or Escape key.
 */
export function CreditsButton(): JSX.Element {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e: MouseEvent): void => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div className="credits-button__wrapper" ref={containerRef}>
            <button
                className="top-bar__import-button"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                type="button"
            >
                Credits
            </button>
            {open && (
                <div className="credits-button__dropdown">
                    <p className="credits-button__heading">Icon credits</p>
                    <ul className="credits-button__list">
                        <li><a href="https://www.svgrepo.com/svg/532493/eye" target="_blank" rel="noopener noreferrer">Eye icon — SVGRepo</a></li>
                        <li><a href="https://www.svgrepo.com/svg/433895/pen" target="_blank" rel="noopener noreferrer">Edit icon — SVGRepo</a></li>
                    </ul>
                </div>
            )}
        </div>
    );
}
