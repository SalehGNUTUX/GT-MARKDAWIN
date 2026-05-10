import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('GT-MARKDAWIN Error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem', color: 'var(--error, #f85149)',
          background: 'var(--surface, #161b22)', borderRadius: 10,
          border: '1px solid var(--error, #f85149)', margin: '1rem', fontFamily: 'monospace',
          direction: 'ltr',
        }}>
          <strong>⚠️ خطأ في التطبيق</strong>
          <pre style={{ marginTop: '0.5rem', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '1rem', padding: '0.4rem 1rem', cursor: 'pointer',
              background: 'var(--accent, #2f81f7)', color: '#fff',
              border: 'none', borderRadius: 6, fontFamily: 'inherit',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
