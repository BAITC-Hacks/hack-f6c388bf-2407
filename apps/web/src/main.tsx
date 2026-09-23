import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

class AppBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="initial-state"><h1>Не удалось открыть симулятор</h1><p>Перезагрузите страницу. Сохранённый сценарий останется в этом браузере.</p><button type="button" className="button button-primary" onClick={() => location.reload()}>Перезагрузить</button></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><AppBoundary><App /></AppBoundary></React.StrictMode>);
