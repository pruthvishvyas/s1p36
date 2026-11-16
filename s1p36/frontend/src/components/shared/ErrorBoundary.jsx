import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="card state-card" role="alert">
          <p>{(this.props.label || 'This section') + ' could not be displayed.'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
