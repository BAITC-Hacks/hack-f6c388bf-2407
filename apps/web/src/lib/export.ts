import type { Catalog, Decision, ScenarioResult } from './types';
import { formatNumber, signed } from './presentation';

export function exportReport(result: ScenarioResult, decisions: Decision[], catalog: Catalog) {
  const analysis = result.ai_analysis ?? result.model_analysis;
  const text = [
    'АКИМ НА 5 ЧАСОВ — ОТЧЁТ ПО СЦЕНАРИЮ', 'Астана · синтетические данные · горизонт 8 кварталов', '',
    `Astana Quality of Life Score: ${formatNumber(result.score, 2)} / 100 (${signed(result.score_delta)} к базе)`,
    `Бюджет: ${result.budget.spent} из ${result.budget.total} ед. Остаток: ${result.budget.remaining} ед.`,
    `Критические показатели: ${result.critical_pairs}`, '', 'ВЫБРАННЫЕ ИНИЦИАТИВЫ',
    ...decisions.map((decision, index) => { const initiative = catalog.initiatives.find((item) => item.id === decision.initiative_id)!; return `${index + 1}. ${initiative.id} — ${initiative.name_ru} · ${catalog.districts.find((item) => item.id === decision.district_id)?.name_ru ?? 'Весь город'} · ${initiative.cost} ед.`; }),
    '', 'ОЦЕНКИ РАЙОНОВ', ...result.districts.map((district) => `${district.name_ru}: ${formatNumber(district.baseline_score, 2)} → ${formatNumber(district.score, 2)} (${signed(district.delta)})`),
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
