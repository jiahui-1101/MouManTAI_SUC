import { Component, type ReactNode } from "react";
import { Notice } from "./ui";

/** Keeps a failed projection from blanking the whole page; shows the reason instead. */
export class P2ErrorBoundary extends Component<{ label: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Notice tone="bad" title={`${this.props.label} could not be calculated`}>
          {this.state.error.message}
        </Notice>
      );
    }
    return this.props.children;
  }
}
