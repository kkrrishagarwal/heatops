import React from 'react'

// Last line of defence: if any component throws during render (a missing field
// in a data file, an unexpected API shape, a bad geometry), React would
// otherwise unmount the entire tree and leave the user staring at a blank
// page. This catches it, shows a short message, and offers a reload / retry.
//
// Deliberately a class component — error boundaries can't be written as hooks.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the stack in the console for debugging; the UI stays friendly.
    console.error('[AppErrorBoundary] render error:', error, info?.componentStack)
  }

  handleRetry = () => {
    // Re-render the subtree; if the failure was transient (e.g. a fetch that has
    // since succeeded) this recovers without a full reload.
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const { title = 'Something went wrong', compact = false } = this.props
    const message = this.state.error?.message || 'Unexpected error'

    if (compact) {
      // Panel-sized fallback (used around individual dashboard sections)
      return (
        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(185, 28, 28, 0.4)',
          borderRadius: 12,
          padding: 16,
          color: '#e2e8f0',
          fontSize: 12
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ {title}</div>
          <div style={{ color: '#94a3b8', marginBottom: 10 }}>
            This section could not be displayed. Please try again.
          </div>
          <button type="button" onClick={this.handleRetry} style={buttonStyle}>🔄 Retry</button>
        </div>
      )
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 24
      }}>
        <div style={{
          maxWidth: 440,
          width: '100%',
          background: '#1e293b',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)'
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚠️ {title}</div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 16 }}>
            BhaskarOps hit an unexpected error while drawing this screen. Your data is safe —
            try again, or reload the page if it keeps happening.
          </div>
          <details style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>
            <summary style={{ cursor: 'pointer' }}>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontFamily: 'monospace' }}>{message}</pre>
          </details>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={this.handleRetry} style={buttonStyle}>🔄 Try again</button>
            <button type="button" onClick={() => window.location.reload()} style={{ ...buttonStyle, background: 'transparent', color: '#d97706' }}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}

const buttonStyle = {
  background: '#d97706',
  color: '#0f172a',
  border: '1px solid rgba(217, 119, 6, 0.6)',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer'
}
