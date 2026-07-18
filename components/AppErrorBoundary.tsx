import React from "react";

type State = { hasError: boolean };
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    window.dispatchEvent(new CustomEvent("formaltype:error", { detail: { message: error.message, stack: info.componentStack } }));
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="grid min-h-screen place-items-center px-5 text-paper"><section className="max-w-lg rounded-lg border border-paper/10 bg-ink-900 p-8 text-center"><p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">Something slipped</p><h1 className="mt-4 text-page font-semibold">This page could not finish loading.</h1><p className="mt-3 text-sm leading-6 text-paper/50">Your saved practice data is untouched. Refresh the page to try again.</p><button className="landing-button-primary mt-7" onClick={() => location.reload()}>Refresh page</button></section></main>;
  }
}
