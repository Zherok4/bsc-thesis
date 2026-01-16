import type { JSX } from 'react';
import { useToast, type Toast } from './context/ToastContext';
import './Toast.css';

/**
 * Individual toast notification component
 */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }): JSX.Element {
    return (
        <div className={`toast toast-${toast.type}`} role="alert">
            <span className="toast-message">{toast.message}</span>
            <button
                className="toast-dismiss"
                onClick={onDismiss}
                aria-label="Dismiss notification"
            >
                &times;
            </button>
        </div>
    );
}

/**
 * Container component that renders all active toast notifications
 */
export default function ToastContainer(): JSX.Element {
    const { toasts, dismissToast } = useToast();

    if (toasts.length === 0) {
        return <></>;
    }

    return (
        <div className="toast-container" aria-live="polite">
            {toasts.map(toast => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onDismiss={() => dismissToast(toast.id)}
                />
            ))}
        </div>
    );
}
