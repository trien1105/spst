import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Tương thích tối đa canvas roundRect trên mọi trình duyệt
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    this.rect(x, y, w, h);
  };
}

// Bắt lỗi toàn cục
window.addEventListener('error', (e) => {
  console.error('[Global Error Listener]:', e.error || e.message);
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lỗi giao diện game:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#111c18] text-amber-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-[#182923] border border-amber-600/50 rounded-2xl p-8 max-w-lg shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold text-amber-400">Đã xảy ra sự cố hiển thị</h2>
            <p className="text-sm text-stone-300">
              Hệ thống đã tự động ghi nhận lỗi. Bạn vui lòng bấm nút bên dưới để tải lại game.
            </p>
            {this.state.error && (
              <pre className="text-xs bg-black/40 text-red-300 p-3 rounded-lg overflow-x-auto text-left">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold rounded-xl shadow-lg transition"
            >
              Tải lại trang (F5)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
