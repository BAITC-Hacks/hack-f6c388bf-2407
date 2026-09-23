import type { Catalog, Decision, ScenarioResult } from './types';
import { formatNumber, signed } from './presentation';

export function exportReport(result: ScenarioResult, decisions: Decision[], catalog: Catalog) {
  const analysis = result.ai_analysis ?? result.model_analysis;
  const text = [
    'АКИМ НА 5 ЧАСОВ — ОТЧЁТ ПО СЦЕНАРИЮ', 'Астана · синтетические данные · горизонт 8 кварталов', '',
    `Astana Quality of Life Score: ${formatNumber(result.score, 2)} / 100 (${signed(result.score_delta)} к базе)`,
    `Стратегия: ${result.strategy_title}`,
    `Индекс равномерности: ${formatNumber(result.fairness_index, 2)} / 100 (разрыв районов ${formatNumber(result.district_gap, 2)})`,
    `Бюджет: ${result.budget.spent} из ${result.budget.total} ед. Остаток: ${result.budget.remaining} ед.`,
    `Критические показатели: ${result.critical_pairs}`, '', 'ВЫБРАННЫЕ ИНИЦИАТИВЫ',
    ...decisions.map((decision, index) => { const initiative = catalog.initiatives.find((item) => item.id === decision.initiative_id)!; return `${index + 1}. ${initiative.id} — ${initiative.name_ru} · ${catalog.districts.find((item) => item.id === decision.district_id)?.name_ru ?? 'Весь город'} · ${initiative.cost} ед.`; }),
    '', 'ОЦЕНКИ РАЙОНОВ', ...result.districts.map((district) => `${district.name_ru}: ${formatNumber(district.baseline_score, 2)} → ${formatNumber(district.score, 2)} (${signed(district.delta)})`),
    '', 'ДИНАМИКА ПО КВАРТАЛАМ', ...result.timeline.map((point) => `${point.quarter === 0 ? 'Сейчас' : `${point.quarter} квартал`}: ${formatNumber(point.score, 2)} (${signed(point.score_delta)})`),
    '', 'СРАВНЕНИЕ С ОПТИМИЗАТОРОМ',
    `Максимум Score: ${formatNumber(result.optimization.max_score.score, 2)} · равномерность ${formatNumber(result.optimization.max_score.fairness_index, 2)}`,
    `Сбалансированный вариант: ${formatNumber(result.optimization.balanced.score, 2)} · равномерность ${formatNumber(result.optimization.balanced.fairness_index, 2)}`,
    '', result.ai_analysis ? 'AI-АНАЛИЗ' : 'МОДЕЛЬНЫЙ РАЗБОР — AI НЕ ИСПОЛЬЗОВАН', analysis.summary,
    '', 'СИЛЬНЫЕ СТОРОНЫ', ...analysis.strengths, '', 'РИСКИ', ...analysis.risks,
    '', 'КОМПРОМИССЫ', ...analysis.tradeoffs, '', 'РЕКОМЕНДАЦИИ', ...analysis.recommendations,
    '', 'Формула: Score = 0,7 × среднее по населению + 0,3 × минимум района − число критических показателей.',
  ].join('\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'astana-scenario-report.txt';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportResultCard(result: ScenarioResult) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext('2d');
  if (!context) return;
  const gradient = context.createLinearGradient(0, 0, 1200, 675);
  gradient.addColorStop(0, '#132f38');
  gradient.addColorStop(1, '#247568');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255,255,255,.08)';
  context.beginPath();
  context.arc(1010, 115, 250, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#b9e8dc';
  context.font = '700 28px Segoe UI';
  context.fillText('АКИМ НА 5 ЧАСОВ · ASTANA 2026', 74, 82);
  context.fillStyle = '#ffffff';
  context.font = '700 54px Segoe UI';
  context.fillText(result.strategy_title, 74, 165);
  context.font = '800 150px Segoe UI';
  context.fillText(formatNumber(result.score, 2), 70, 355);
  context.font = '500 30px Segoe UI';
  context.fillStyle = '#d9eee9';
  context.fillText('Astana Quality of Life Score / 100', 78, 405);
  context.font = '700 30px Segoe UI';
  context.fillStyle = '#ffffff';
  context.fillText(`${signed(result.score_delta)} к базе`, 78, 490);
  context.fillText(`Равномерность ${formatNumber(result.fairness_index, 1)} / 100`, 395, 490);
  context.fillText(`Бюджет ${result.budget.spent} / ${result.budget.total}`, 815, 490);
  context.fillStyle = '#b9d5d0';
  context.font = '500 23px Segoe UI';
  context.fillText('5 решений · 5 районов · прогноз на 8 кварталов · синтетические данные', 78, 598);
  const anchor = document.createElement('a');
  anchor.download = 'astana-quality-of-life-card.png';
  anchor.href = canvas.toDataURL('image/png');
  anchor.click();
}
