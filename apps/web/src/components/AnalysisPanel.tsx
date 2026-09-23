import type { ScenarioResult } from '../lib/types';
import { formatNumber, signed } from '../lib/presentation';
import { Icon, type IconName } from './Icon';
import { Button } from './ui';

export function AnalysisPanel({ result, running, selectedCount, ready, onRun }: { result: ScenarioResult | null; running: boolean; selectedCount: number; ready: boolean; onRun: () => void }) {
  const analysis = result?.ai_analysis ?? result?.model_analysis;
  const groups: { key: 'strengths' | 'risks' | 'tradeoffs' | 'recommendations'; title: string; icon: IconName }[] = [
    { key: 'strengths', title: 'Сильные стороны', icon: 'chart' }, { key: 'risks', title: 'Риски', icon: 'shield' },
    { key: 'tradeoffs', title: 'Компромиссы', icon: 'services' }, { key: 'recommendations', title: 'Рекомендации', icon: 'spark' },
  ];
  return <section id="analysis" className="analysis-panel panel" aria-labelledby="analysis-title" aria-busy={running}>
    <div className="panel-heading"><div className="analysis-heading"><span className="ai-icon"><Icon name="spark" size={22}/></span><div><span className="eyebrow">ОТ ЦИФР К ПОНИМАНИЮ</span><h2 id="analysis-title">AI-анализ вашего города</h2></div></div><span className="badge">{running ? 'Готовим разбор' : result?.ai_analysis ? 'AI-анализ готов' : result ? 'Модельный разбор' : 'После симуляции'}</span></div>
    {analysis && result ? <><div className="analysis-summary"><h3>Пять решений. <span>{signed(result.score_delta)} балла</span> к качеству жизни.</h3><p>{analysis.summary}</p></div>{!result.ai_analysis && <div className="analysis-disclosure"><Icon name="info" size={16}/><span>{result.ai_status === 'unavailable' ? 'AI-сервис сейчас недоступен.' : 'AI-провайдер не подключён.'} Ниже — детерминированное объяснение модели. Числовой результат рассчитан полностью.</span></div>}<div className="analysis-grid">{groups.map((group) => <article key={group.key} className={`analysis-group analysis-${group.key}`}><h3><Icon name={group.icon} size={18}/>{group.title}</h3><ul>{analysis[group.key].map((text, index) => <li key={`${group.key}-${index}`}>{text}</li>)}</ul></article>)}</div><div className="analysis-footer"><span><Icon name="check" size={16}/>Score {formatNumber(result.score, 2)} рассчитан сервером</span><span>Горизонт: 8 кварталов · данные синтетические</span></div></> : <div className="analysis-empty"><div><h3>{running ? 'Проверяем, каким станет город' : 'У каждого решения есть последствия'}</h3><p>{running ? 'Результат появится здесь. Можно продолжать изучать показатели районов.' : 'Узнайте, где ваш план сработает лучше всего, какие риски останутся и что можно улучшить.'}</p><div className="analysis-topics">{groups.map((group) => <span key={group.key}><Icon name={group.icon} size={15}/>{group.title}</span>)}</div></div><div className="analysis-empty-action"><Button onClick={onRun} variant="primary" disabled={!ready} busy={running}><Icon name="spark" size={16}/>Получить анализ</Button><span>{selectedCount < 5 ? `Сначала выберите 5 инициатив · сейчас ${selectedCount}` : 'Запустите выбранный сценарий'}</span></div></div>}
  </section>;
}
