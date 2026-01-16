import { createContext, useContext, useState, useCallback, type ReactNode, type JSX } from 'react';

/**
 * Represents a toast notification
 */
export interface Toast {
    /** Unique identifier for the toast */
    id: string;
    /** Message to display */
    message: string;
    /** Type determines the color scheme */
    type: 'success' | 'error' | 'info';
}

/**
 * Context value for managing toast notifications
 */
export interface ToastContextValue {
    /** Current list of active toasts */
    toasts: Toast[];
    /**
     * Shows a toast notification
     * @param message - The message to display
     * @param type - The type of toast (success, error, info)
     */
    showToast: (message: string, type: Toast['type']) => void;
    /**
     * Dismisses a specific toast
     * @param id - The ID of the toast to dismiss
     */
    dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** Auto-dismiss timeout in milliseconds */
const TOAST_DURATION = 3000;

/**
 * Provider component for toast notifications
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: Toast['type']) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = { id, message, type };

        setToasts(prev => [...prev, newToast]);

        // Auto-dismiss after duration
        setTimeout(() => {
            dismissToast(id);
        }, TOAST_DURATION);
    }, [dismissToast]);

    return (
        <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
            {children}
        </ToastContext.Provider>
    );
}

/**
 * Hook to access toast functionality
 * @throws Error if used outside of ToastProvider
 */
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export { ToastContext };
