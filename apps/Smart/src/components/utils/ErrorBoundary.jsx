import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "white", padding: "20px", background: "rgba(255,0,0,0.5)", borderRadius: "8px", zIndex: 9999, position: "relative", whiteSpace: "pre-wrap" }}>
          <h2>💥 Component Crash</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
          <details>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
