import { Component, type ReactNode, type ErrorInfo } from 'react';

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Fallback UI to render when an error occurs */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Name of the component being wrapped (for error messages) */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 *
 * Prevents the entire app from crashing when a component throws an error.
 * Displays a fallback UI instead and logs the error for debugging.
 *
 * @example
 * ```tsx
 * <ErrorBoundary componentName="Sidebar" fallback={<div>Graph failed to load</div>}>
 *   <Sidebar {...props} />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, componentName } = this.props;

    console.error(
      `[ErrorBoundary${componentName ? `: ${componentName}` : ''}] Caught error:`,
      error,
      errorInfo
    );

    onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, componentName } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="error-boundary-fallback" style={styles.container}>
          <div style={styles.content}>
            <h3 style={styles.title}>
              {componentName ? `${componentName} Error` : 'Something went wrong'}
            </h3>
            <p style={styles.message}>
              {error?.message || 'An unexpected error occurred'}
            </p>
            <button onClick={this.handleRetry} style={styles.button}>
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '200px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px',
  },
  content: {
    textAlign: 'center',
    maxWidth: '400px',
  },
  title: {
    margin: '0 0 8px 0',
    color: '#991b1b',
    fontSize: '16px',
    fontWeight: 600,
  },
  message: {
    margin: '0 0 16px 0',
    color: '#dc2626',
    fontSize: '14px',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default ErrorBoundary;
