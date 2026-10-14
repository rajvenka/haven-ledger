import React, { Component } from 'react';

type Props = { children?: React.ReactNode };
type State = { err: Error | null };

/** Catches render errors in a page so a crash shows a readable message instead of a blank screen. */
export default class PageErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare setState: Component<Props, State>['setState'];
  state: State = { err: null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error, info: React.ErrorInfo) { console.error('[PageErrorBoundary]', err, info.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-xl mx-auto rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 p-4 space-y-2">
          <p className="text-sm font-black text-rose-700 dark:text-rose-300">This page hit an error</p>
          <p className="text-[12px] font-mono text-rose-600 dark:text-rose-400 break-words">{this.state.err.message}</p>
          <button type="button" onClick={() => this.setState({ err: null })} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[12px] font-bold">Try again</button>
        </div>
      </div>
    );
  }
}
