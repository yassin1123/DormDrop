"use client";

import { Component, type ReactNode } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback. Receives the error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Client-side React error boundary. Catches render/runtime errors in its
 * subtree and shows a recoverable fallback, so one broken widget can't take
 * the whole app down. (Route-level server errors are handled by Next's
 * error.tsx files.)
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return (
        <ErrorState
          title="This screen crashed"
          message="An unexpected error occurred. You can try reloading this section."
          onRetry={this.reset}
          retryLabel="Reload"
        />
      );
    }
    return this.props.children;
  }
}
