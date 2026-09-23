import { useMemo, useState } from 'react';
import type { Catalog, Decision, Preview, ScenarioResult, StressResponse, TimelinePoint } from '../lib/types';
import { exportResultCard } from '../lib/export';
import { domains, formatNumber, signed } from '../lib/presentation';
import { Button } from './ui';
import { Icon } from './Icon';

function timelinePath(points: TimelinePoint[]) {
  const min = Math.min(...points.map((point) => point.score), 45) - 1;
  const max = Math.max(...points.map((point) => point.score), 60) + 1;
  return points.map((point, index) => {
    const x = 26 + index * 137;
    const y = 145 - ((point.score - min) / Math.max(1, max - min)) * 105;
    return `${index ? 'L' : 'M'}${x},${y}`;
  }).join(' ');
}

export function TimelinePanel({ points }: { points: TimelinePoint[] }) {
  const path = useMemo(() => timelinePath(points), [points]);
  return <section className="panel timeline-panel" aria-labelledby="timeline-title">
    <div className="panel-heading"><div><span className="eyebrow">ГОРОД ЧЕРЕЗ 2 ГОДА</span><h2 id="timeline-title">Когда решения начнут работать</h2></div><span className="badge"><Icon name="clock" size={14}/>8 кварталов</span></div>
    <div className="timeline-chart">
      <svg viewBox="0 0 600 175" role="img" aria-label="Изменение Astana Quality of Life Score по кварталам">
        <path d="M26 145H574M26 92H574M26 40H574" className="timeline-grid"/>
        <path d={path} className="timeline-line"/>
        {points.map((point, index) => {
          const x = 26 + index * 137;
          const values = path.match(/(?:M|L)([\d.]+),([\d.]+)/g) ?? [];
          const y = Number(values[index]?.split(',')[1] ?? 145);
          return <g key={point.quarter} transform={`translate(${x} ${y})`}><circle r="6"/><text y="-13" textAnchor="middle">{formatNumber(point.score, 1)}</text><text y={165 - y} textAnchor="middle" className="quarter-label">{point.quarter === 0 ? 'Сейчас' : `${point.quarter} кв.`}</text></g>;
        })}
      </svg>
    </div>
    <div className="timeline-legend">{domains.map((domain) => <span key={domain.id} className={`domain-${domain.id}`}><i/>{domain.short}: {formatNumber(points.at(-1)?.domain_metrics[domain.id] ?? 0, 1)}</span>)}</div>
  </section>;
}

export function ImpactBreakdown({ metrics }: { metrics: Preview | ScenarioResult }) {
  const score = 'score' in metrics ? metrics.score : metrics.projected_score;
  const pieces = [
    { label: '70% · среднее города', value: metrics.score_breakdown.city_component, tone: 'positive' },
    { label: '30% · слабейший район', value: metrics.score_breakdown.weakest_component, tone: 'positive' },
    { label: 'Штраф за критические значения', value: -metrics.score_breakdown.critical_penalty, tone: 'negative' },
  ];
  return <section className="panel breakdown-panel" aria-labelledby="breakdown-title">
    <div className="panel-heading"><div><span className="eyebrow">ОБЪЯСНИМАЯ МОДЕЛЬ</span><h2 id="breakdown-title">Почему получилось {formatNumber(score, 2)}</h2></div><span className="fairness-badge">Равномерность <strong>{formatNumber(metrics.fairness_index, 1)}</strong></span></div>
    <div className="breakdown-equation">{pieces.map((piece, index) => <div key={piece.label} className={piece.tone}><span>{piece.label}</span><strong>{piece.value >= 0 ? '+' : '−'}{formatNumber(Math.abs(piece.value), 2)}</strong>{index < pieces.length - 1 && <b>{index === 0 ? '+' : '−'}</b>}</div>)}<div className="equals"><span>Итоговый Score</span><strong>{formatNumber(score, 2)}</strong></div></div>
    <p className="fairness-note"><Icon name="map" size={16}/>Разрыв между сильнейшим и слабейшим районом — {formatNumber(metrics.district_gap, 1)} балла. Чем ближе индекс равномерности к 100, тем ровнее развивается город.</p>
  </section>;
}

function scenarioNames(decisions: Decision[], catalog: Catalog) {
  return decisions.map((decision) => `${decision.initiative_id} · ${catalog.districts.find((district) => district.id === decision.district_id)?.name_ru ?? 'весь город'}`).join(', ');
}

export function OptimizerPanel({ result, catalog, applyScenario }: { result: ScenarioResult; catalog: Catalog; applyScenario: (decisions: Decision[], message: string) => void }) {
  const options = [
    { title: 'Ваш сценарий', score: result.score, fairness: result.fairness_index, budget: result.budget, decisions: null, badge: 'ТЕКУЩИЙ' },
    { title: 'Максимум Score', score: result.optimization.max_score.score, fairness: result.optimization.max_score.fairness_index, budget: result.optimization.max_score.budget, decisions: result.optimization.max_score.decisions, badge: 'АЛГОРИТМ' },
    { title: 'Баланс районов', score: result.optimization.balanced.score, fairness: result.optimization.balanced.fairness_index, budget: result.optimization.balanced.budget, decisions: result.optimization.balanced.decisions, badge: 'АЛГОРИТМ' },
  ];
  const swap = result.optimization.best_swap;
  const oldName = catalog.initiatives.find((item) => item.id === swap?.removed_id)?.name_ru;
  const newName = catalog.initiatives.find((item) => item.id === swap?.added_id)?.name_ru;
  return <section className="panel optimizer-panel" aria-labelledby="optimizer-title">
    <div className="panel-heading"><div><span className="eyebrow">DECISION ENGINE</span><h2 id="optimizer-title">Сравнение с оптимизированными сценариями</h2><p>Алгоритм перебирает допустимые комбинации бюджета, районов и направлений.</p></div><span className="badge"><Icon name="spark" size={14}/>Оптимизатор</span></div>
    <div className="optimizer-grid">{options.map((option) => <article key={option.title} className={!option.decisions ? 'is-current' : ''}><span>{option.badge}</span><h3>{option.title}</h3><strong>{formatNumber(option.score, 2)}</strong><dl><div><dt>Равномерность</dt><dd>{formatNumber(option.fairness, 1)}</dd></div><div><dt>Бюджет</dt><dd>{option.budget.spent}/{option.budget.total}</dd></div></dl>{option.decisions && <><p title={scenarioNames(option.decisions, catalog)}>{scenarioNames(option.decisions, catalog)}</p><Button onClick={() => applyScenario(option.decisions!, `${option.title} загружен в ваш сценарий.`)}>Применить сценарий</Button></>}</article>)}</div>
    {swap && <div className="swap-recommendation"><Icon name="up" size={20}/><div><strong>Одна замена даст ещё {signed(swap.gain)} балла</strong><span>Замените «{oldName}» на «{newName}» без превышения бюджета.</span></div><Button variant="primary" onClick={() => applyScenario(swap.decisions, 'Рекомендованная замена применена.')}>Применить замену</Button></div>}
  </section>;
}

export function StressTestPanel({ result }: { result: ScenarioResult }) {
  const firstAvailable = result.stress_test.responses.find((response) => response.available)?.id ?? '';
  const [selectedId, setSelectedId] = useState(firstAvailable);
  const selected = result.stress_test.responses.find((response) => response.id === selectedId) as StressResponse | undefined;
  return <section className="panel stress-panel" aria-labelledby="stress-title">
    <div className="stress-heading"><span className="event-icon"><Icon name="warning" size={24}/></span><div><span className="eyebrow">НЕОЖИДАННОЕ СОБЫТИЕ · SEED {result.stress_test.seed}</span><h2 id="stress-title">{result.stress_test.title_ru}</h2><p>{result.stress_test.description_ru}</p></div></div>
    <div className="stress-options" role="radiogroup" aria-label="Ответ на городское событие">{result.stress_test.responses.map((response) => <button key={response.id} type="button" role="radio" aria-checked={selectedId === response.id} disabled={!response.available} onClick={() => setSelectedId(response.id)}><span>{response.cost ? `${response.cost} ед.` : '0 ед.'}</span><strong>{response.name_ru}</strong><small>{response.available ? response.description_ru : 'Недостаточно резерва бюджета'}</small></button>)}</div>
    {selected?.available && <div className="stress-result"><div><span>Score после события</span><strong>{formatNumber(selected.score ?? 0, 2)} <small>{signed(selected.score_delta ?? 0)}</small></strong></div><div><span>Равномерность</span><strong>{formatNumber(selected.fairness_index ?? 0, 1)}</strong></div><div><span>Критических показателей</span><strong>{selected.critical_pairs}</strong></div><div><span>Резерв после ответа</span><strong>{selected.budget?.remaining} ед.</strong></div></div>}
  </section>;
}

export function ResultCard({ result }: { result: ScenarioResult }) {
  return <section className="result-card" aria-label="Итоговая карточка сценария">
    <div><span>ВАША СТРАТЕГИЯ</span><h2>{result.strategy_title}</h2><p>5 решений · прогноз на 8 кварталов</p></div><div className="result-card-score"><strong>{formatNumber(result.score, 2)}</strong><span>QUALITY OF LIFE</span></div><dl><div><dt>Рост</dt><dd>{signed(result.score_delta)}</dd></div><div><dt>Равномерность</dt><dd>{formatNumber(result.fairness_index, 1)}</dd></div><div><dt>Бюджет</dt><dd>{result.budget.spent}/{result.budget.total}</dd></div></dl><Button onClick={() => exportResultCard(result)}><Icon name="download" size={16}/>Скачать карточку PNG</Button>
  </section>;
}
