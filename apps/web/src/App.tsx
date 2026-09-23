import { useCallback, useEffect, useState } from 'react';
import { AnalysisPanel } from './components/AnalysisPanel';
import { CityMap } from './components/CityMap';
import { DistrictTable } from './components/DistrictTable';
import { ImpactBreakdown, OptimizerPanel, ResultCard, StressTestPanel, TimelinePanel } from './components/DecisionIntelligence';
import { Icon, type IconName } from './components/Icon';
import { InitiativeCatalog } from './components/InitiativeCatalog';
import { BudgetOverview, CategoryMetrics, ScoreCard } from './components/Overview';
import { ScenarioPanel } from './components/ScenarioPanel';
import { Alert, Button, Toast } from './components/ui';
import { useScenario } from './hooks/useScenario';
import { exportReport } from './lib/export';
import type { DistrictId, Domain } from './lib/types';

const navigation: { id: string; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Обзор города', icon: 'grid' },
  { id: 'initiatives', label: 'Инициативы', icon: 'list' },
  { id: 'districts', label: 'Районы города', icon: 'map' },
  { id: 'analysis', label: 'AI-анализ', icon: 'spark' },
];

export default function App() {
  const scenario = useScenario();
  const [district, setDistrict] = useState<DistrictId>('nura');
  const [filter, setFilter] = useState<Domain | 'all'>('transport');
  const [activeSection, setActiveSection] = useState(location.hash.slice(1) || 'overview');
  const closeNotice = useCallback(() => scenario.setNotice(null), [scenario.setNotice]);
  const { catalog, preview, result, decisions } = scenario;
  useEffect(() => {
    const syncHash = () => setActiveSection(location.hash.slice(1) || 'overview');
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);
  useEffect(() => {
    if (!catalog) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id);
    }, { rootMargin: '-10% 0px -65% 0px' });
    for (const item of [...navigation, { id: 'methodology' }]) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [catalog]);
  const metrics = result ?? preview;
  function handleExport() {
    if (!result || !catalog) return;
    exportReport(result, decisions, catalog);
    scenario.setNotice({ text: 'Отчёт подготовлен для скачивания.' });
  }
  return <div className="app-shell"><a href="#main-content" className="skip-link">Перейти к содержимому</a>
    <aside className="sidebar"><a className="brand" href="#overview"><span className="brand-mark"><Icon name="city" size={26}/></span><span>Аким<span>на 5 часов</span></span></a><div className="workspace-label">ГОРОДСКАЯ ЛАБОРАТОРИЯ</div><nav aria-label="Главная навигация">{navigation.map((item) => <a key={item.id} href={`#${item.id}`} className={activeSection === item.id ? 'is-active' : ''} aria-current={activeSection === item.id ? 'location' : undefined}><Icon name={item.icon}/><span>{item.label}</span>{item.id === 'analysis' && <span className="nav-ai-badge">AI</span>}</a>)}</nav><div className="sidebar-bottom"><div className="city-passport"><span className="eyebrow">ВАШ ГОРОД</span><strong>Астана<span>Казахстан</span></strong><div className="passport-line"><span>5 районов</span><span>1 общее будущее</span></div><div className="passport-skyline" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div></div><a className={activeSection === 'methodology' ? 'help-link is-active' : 'help-link'} href="#methodology"><Icon name="book" size={18}/><span>Как работает симулятор</span></a><div className="sidebar-footer"><span className="status-dot"/>Учебная симуляция<span>v1.0</span></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Рабочее пространство<Icon name="chevron" size={13}/><strong>Симулятор города</strong></div><div className="topbar-meta"><span className="environment-badge">Синтетические данные</span><span className="avatar" aria-label="Роль: городской управленец">АК</span></div></header>
      <main id="main-content" tabIndex={-1}>
        <div id="overview" className="page-heading"><div><div className="eyebrow">ASTANA · CITY DIGITAL TWIN</div><h1>Увидьте Астану через 2 года<span>.</span></h1><p>Пять решений, ограниченный бюджет и последствия для каждого района.</p></div><div className="page-actions"><Button variant="primary" onClick={scenario.runDemo} disabled={!catalog || scenario.running}><Icon name="play" size={16}/>Демо за 30 секунд</Button><Button onClick={scenario.loadDemo} disabled={!catalog || scenario.running}><Icon name="spark" size={16}/>Загрузить пример</Button><Button onClick={handleExport} disabled={!result} title={!result ? 'Экспорт доступен после симуляции' : 'Скачать текстовый отчёт'}><Icon name="download" size={16}/>Экспорт отчёта</Button></div></div>
        {!catalog || !preview || !metrics ? <div className="initial-state panel">{scenario.catalogError ? <><span className="empty-icon"><Icon name="warning" size={30}/></span><h2>Не удалось загрузить город</h2><p>Для работы симулятора нужен запущенный сервис расчёта.</p><Alert retry={scenario.retryCatalog}>{scenario.catalogError}</Alert></> : <><span className="spinner large-spinner"/><h2>Готовим рабочее пространство</h2><p role="status">Загружаем районы, инициативы и исходные показатели…</p></>}</div> : <>
          {scenario.storageFailed && <Alert tone="info">Браузер не разрешил сохранить сценарий. Оставьте эту страницу открытой, чтобы не потерять выбор.</Alert>}
          <BudgetOverview catalog={catalog} decisions={decisions}/>
          <div className="overview-grid"><CityMap districts={metrics.districts} active={district} onSelect={setDistrict}/><ScoreCard metrics={preview} result={result} hasDecisions={!!decisions.length} fresh={scenario.fresh}/></div>
          <div className="intelligence-grid"><TimelinePanel points={result?.timeline ?? preview.timeline}/><ImpactBreakdown metrics={result ?? preview}/></div>
          <div className="metrics-heading"><h2>Пульс города</h2><span role="status">{scenario.previewError ? 'Прогноз не обновлён' : !scenario.fresh ? 'Обновляем показатели…' : result ? 'Результат симуляции' : 'Живой прогноз'}<span className={`status-dot ${!scenario.fresh ? 'is-pending' : ''}`}/></span></div>
          <CategoryMetrics metrics={metrics} baseline={catalog.baseline_result} filter={filter} onFilter={(domain) => { setFilter(domain); document.getElementById('initiatives')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }}/>
          {scenario.previewError && <Alert retry={scenario.retryPreview}>{scenario.previewError} Отображается последний успешный прогноз; итоговая симуляция недоступна.</Alert>}
          {decisions.length >= 3 && !result && <div className="event-teaser"><span className="event-icon"><Icon name="warning" size={20}/></span><div><strong>Городская обстановка изменилась</strong><span>После запуска сценария ваш бюджет пройдёт стресс-тест неожиданным событием. Сохранённый резерв может стать решающим.</span></div></div>}
          {result && <div className="result-banner" role="status"><Icon name="check" size={20}/><span>Сценарий рассчитан. Результаты и рекомендации готовы.</span><a href="#analysis">Перейти к анализу<Icon name="arrow" size={16}/></a></div>}
          <div className="planning-grid"><InitiativeCatalog {...{ catalog, decisions, preview, filter, setFilter }} busy={!scenario.fresh || scenario.running || !!scenario.previewError} add={scenario.add} remove={scenario.remove}/><ScenarioPanel {...{ catalog, decisions, preview }} fresh={scenario.fresh && !scenario.previewError} running={scenario.running} runError={scenario.runError} run={scenario.run} remove={scenario.remove} changeDistrict={scenario.changeDistrict} reset={scenario.reset} loadDemo={scenario.loadDemo}/></div>
          <AnalysisPanel result={result} running={scenario.running} selectedCount={decisions.length} ready={scenario.fresh && preview.complete && !scenario.previewError} onRun={scenario.run}/>
          {result && <><ResultCard result={result}/><OptimizerPanel result={result} catalog={catalog} applyScenario={scenario.applyScenario}/><StressTestPanel result={result}/></>}
          <DistrictTable metrics={metrics} catalog={catalog}/>
          <section id="methodology" className="methodology panel" aria-labelledby="method-title"><div><span className="eyebrow">ПРОЗРАЧНАЯ МОДЕЛЬ</span><h2 id="method-title">Хороший город — для каждого</h2><p>Оценка учитывает не только средние показатели, но и самый уязвимый район. Все команды начинают с одинаковых данных и бюджета.</p><div className="formula">Score = 0,7 × среднее + 0,3 × минимум − штрафы</div></div><div className="method-rules"><div><span>100</span><p>условных единиц бюджета</p></div><div><span>5</span><p>решений, максимум 2 в направлении</p></div><div><span>8</span><p>кварталов на реализацию эффектов</p></div></div><details><summary>Правила расчёта и несовместимости</summary><p>Каждая мера выбирается один раз. Для районной меры указывается один район. Реализованный эффект = полный эффект × (8 − лаг) / 8. Синергии не уменьшаются из-за лага. Показатели ограничены диапазоном 0–100. Каждый показатель строго ниже 40 уменьшает итог на 1 балл. Остаток бюджета не даёт бонуса.</p><ul>{catalog.rules.incompatible_pairs.map((pair) => <li key={pair.initiatives.join('-')}><strong>{pair.initiatives.join(' + ')}</strong> — {pair.reason_ru}{pair.scope === 'same_district' ? ' Ограничение действует в одном районе.' : ' Ограничение действует во всём городе.'}</li>)}</ul><p>Ровно пять решений могут охватывать от трёх до пяти направлений. Все числа считает сервер; AI объясняет полученный результат. Это учебная модель, а не прогноз реальной городской политики.</p></details></section>
        </>}
        <footer className="page-footer"><span>Аким на 5 часов<span className="footer-divider">/</span>Лаборатория городских решений</span><span>Сделано для будущего Астаны<Icon name="city" size={16}/></span></footer>
      </main>
    </div><Toast notice={scenario.notice} onClose={closeNotice}/>
  </div>;
}
