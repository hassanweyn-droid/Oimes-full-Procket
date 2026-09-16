// ─────────────────────────────────────────────────────────────────────────────
// OIMES — ErrorBoundary
// Without this, any uncaught render error (a bad property access, malformed
// persisted state, etc.) unmounts the whole React tree and leaves a blank
// white page with no clue why. This catches it and shows a message plus a
// reset button instead.
// ─────────────────────────────────────────────────────────────────────────────

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('OIMES crashed:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#ffffff',
          color: '#0a0a0a',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong.</p>
        <p style={{ fontSize: 13, color: '#717182', maxWidth: 420 }}>{this.state.message}</p>
        <button
          onClick={this.handleReset}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: '#030213',
            color: '#fff',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload app
        </button>
      </div>
    );
  }
}
