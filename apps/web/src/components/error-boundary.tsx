// SPDX-License-Identifier: Apache-2.0

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in the console log to locate which boundary caught the error. */
  label?: string;
  /** Called when the user hits Retry, after the boundary resets — e.g. to
   *  close the overlay that failed to load so the app returns to a good state. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lazy-import errors in its subtree and shows a recovery card
 * instead of letting the error unmount the whole React root to a blank screen
 * (the failure mode for an offline dynamic-import: press E before the editor
 * chunk was ever cached → black screen, unrecoverable without a manual reload).
 *
 * Retry resets the boundary, which re-attempts the lazy import — enough once
 * the network is back. Reload is the fallback.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.warn(`[error-boundary${this.props.label ? ' ' + this.props.label : ''}]`, error);
  }

  private reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const isChunk = /dynamically imported module|Loading chunk|Importing a module|Failed to fetch/i.test(
      error.message,
    );
    const message = isChunk && offline
      ? "This part hasn't been saved for offline use yet. Reconnect to the internet once, and it'll work offline after that."
      : isChunk
        ? "Couldn't load this part of the app. Your connection may have dropped — try again."
        : 'Something went wrong in this view. Your documents are safe and stored locally.';

    return (
      <div
        role="alert"
        style={{
          minHeight: '40vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 32,
          textAlign: 'center',
          color: 'var(--zen-fg, #ece8e0)',
          fontFamily: 'var(--zen-serif, ui-serif, Georgia, serif)',
        }}
      >
        <p style={{ maxWidth: 420, margin: 0, lineHeight: 1.6, opacity: 0.85 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={this.reset}
            style={{
              fontFamily: 'var(--zen-mono, ui-monospace, monospace)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--zen-fg-ghost, rgba(236,232,224,0.2))',
              background: 'var(--zen-paper-tint, rgba(255,255,255,0.04))',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontFamily: 'var(--zen-mono, ui-monospace, monospace)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid transparent',
              background: 'transparent',
              color: 'inherit',
              opacity: 0.6,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
