import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

/**
 * Class-based Error Boundary for resilient frontend error handling.
 * Catches unhandled JavaScript exceptions in child component tree
 * and renders a friendly recovery UI instead of crashing the whole app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log cleanly to console for observability / telemetry
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo?.componentStack);
    this.setState({ errorInfo });
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          reset: this.handleReset,
          reload: this.handleReload,
        });
      }

      const title = this.props.title || 'Đã có sự cố xảy ra';
      const message =
        this.props.message ||
        'Hệ thống gặp lỗi không mong muốn khi hiển thị phần này. Bạn có thể thử lại hoặc tải lại trang.';

      return (
        <div className="min-h-[300px] w-full flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 sm:p-8 shadow-xl shadow-rose-500/5 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="h-7 w-7 stroke-[2]" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>

            {import.meta.env?.DEV && this.state.error && (
              <details className="mt-4 text-left border border-slate-200 rounded-lg bg-slate-50 p-2 text-xs">
                <summary className="cursor-pointer font-medium text-rose-700">
                  Chi tiết lỗi (chỉ hiện ở dev mode)
                </summary>
                <div className="mt-2 font-mono text-[11px] text-slate-800 break-words whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Thử lại</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0D6E6E] hover:bg-[#095454] text-white font-semibold text-sm transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
