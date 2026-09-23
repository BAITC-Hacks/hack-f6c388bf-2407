import type { Catalog, Decision, Domain, Metrics, Preview, ScenarioResult } from '../lib/types';
import { domains, formatNumber, signed } from '../lib/presentation';
import { Icon, type IconName } from './Icon';

export function BudgetOverview({ catalog, decisions }: { catalog: Catalog; decisions: Decision[] }) {
  const spent = decisions.reduce((sum, decision) => sum + (catalog.initiatives.find((item) => item.id === decision.initiative_id)?.cost ?? 0), 0);
  const values: { label: string; value: number; suffix: string; description: string; icon: IconName; className?: string }[] = [
    { label: 'Бюджет города', value: catalog.budget, suffix: 'ед.', description: 'Единый старт для всех команд', icon: 'wallet' },
    { label: 'Распределено', value: spent, suffix: 'ед.', description: `${formatNumber(spent / catalog.budget * 100)}% общего бюджета`, icon: 'chart' },
    { label: 'Осталось', value: catalog.budget - spent, suffix: 'ед.', description: 'Доступно для ваших решений', icon: 'wallet', className: 'stat-green' },
    { label: 'Выбрано инициатив', value: decisions.length, suffix: `/ ${catalog.rules.required_decision_count}`, description: decisions.length === 5 ? 'Можно запускать симуляцию' : `Ещё ${catalog.rules.required_decision_count - decisions.length} до готового сценария`, icon: 'list' },
  ];
  return <section className="stats-grid" aria-label="Обзор бюджета">{values.map((item) => <article className={`stat-card ${item.className ?? ''}`} key={item.label}><div className="stat-top"><span>{item.label}</span><Icon name={item.icon} size={19}/></div><div className="stat-value">{formatNumber(item.value)}<span>{item.suffix}</span></div><p>{item.description}</p>{item.label === 'Распределено' && <div className="stat-progress"><span style={{ width: `${Math.min(100, spent / catalog.budget * 100)}%` }}/></div>}</article>)}</section>;
}
export function ScoreCard({ metrics, result, hasDecisions, fresh }: { metrics: Preview; result: ScenarioResult | null; hasDecisions: boolean; fresh: boolean }) {
  const data = result ?? metrics;
  const score = result?.score ?? metrics.projected_score;
  const weakest = data.districts.find((district) => district.id === data.weakest_district.district_id)!;
  const circumference = 2 * Math.PI * 77;
  return <section className="score-panel" aria-labelledby="score-title" aria-busy={!fresh}>
    <div className="score-top"><span className="eyebrow">КАЧЕСТВО ЖИЗНИ</span><Icon name="chart" size={20}/></div>
    <h2 id="score-title">Astana Quality of Life Score</h2>
    <div className="score-gauge"><svg viewBox="0 0 200 200" aria-hidden="true"><circle className="gauge-track" cx="100" cy="100" r="77"/><circle className="gauge-value" cx="100" cy="100" r="77" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, score)) / 100)}/></svg><div><strong data-testid="quality-score">{formatNumber(score, 2)}</strong><span>из 100 баллов</span></div></div>
    <div className="score-status"><span className={`score-delta ${data.score_delta < 0 ? 'negative' : ''}`}><Icon name="up" size={14}/>{signed(data.score_delta)} к базе</span><span>{!fresh ? 'Прогноз обновляется' : result ? 'Итог симуляции' : hasDecisions ? 'Предварительный прогноз' : 'Базовый уровень'}</span></div>
    <dl className="score-details"><div><dt>Среднее по городу</dt><dd>{formatNumber(data.city_score, 2)}</dd></div><div><dt>Слабейший район · {weakest.name_ru}</dt><dd>{formatNumber(data.weakest_district.score, 2)}</dd></div><div><dt>Критические показатели</dt><dd className={data.critical_pairs > 0 ? 'critical-value' : ''}>{data.critical_pairs}<span>{data.critical_pairs > 0 ? `−${data.critical_pairs} балла` : 'нет штрафа'}</span></dd></div></dl>
    <a href="#methodology" className="score-link">Как рассчитывается оценка<Icon name="arrow" size={16}/></a>
  </section>;
}
export function CategoryMetrics({ metrics, baseline, filter, onFilter }: { metrics: Metrics; baseline: Metrics; filter: Domain | 'all'; onFilter: (domain: Domain) => void }) {
  return <section className="category-metrics" aria-label="Показатели пяти направлений">{domains.map((domain) => <button type="button" key={domain.id} className={`category-metric domain-${domain.id}`} onClick={() => onFilter(domain.id)} aria-pressed={filter === domain.id}><div className="category-metric-heading"><span className="domain-icon"><Icon name={domain.icon} size={18}/></span><span>{domain.short}</span><Icon name="chevron" size={14}/></div><div className="category-metric-value"><strong>{formatNumber(metrics.domain_metrics[domain.id], 1)}</strong><span className="metric-change">{signed(metrics.domain_metrics[domain.id] - baseline.domain_metrics[domain.id], 1)}</span></div><div className="metric-track"><span style={{ width: `${metrics.domain_metrics[domain.id]}%` }}/></div></button>)}</section>;
}
