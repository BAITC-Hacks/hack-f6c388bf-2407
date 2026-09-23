import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <main>
      <p className="eyebrow">ASTANA · CITY SIMULATOR</p>
      <h1>Аким на 5 часов</h1>
      <p className="intro">Распределите бюджет между городскими инициативами и посмотрите, как изменится качество жизни в районах.</p>
      <section className="status" aria-live="polite">
        <span className="pulse" />
        <div><strong>Рабочее пространство готово</strong><p>Интерфейс подключается к API по общему контракту.</p></div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
