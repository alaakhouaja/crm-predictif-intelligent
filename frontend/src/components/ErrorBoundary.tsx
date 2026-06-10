import { Component, type ReactNode } from 'react';
import { AppErrorPage } from '../pages/AppErrorPage';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) return <AppErrorPage />;
    return this.props.children;
  }
}

