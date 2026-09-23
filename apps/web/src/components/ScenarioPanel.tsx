import type { Catalog, Decision, Preview } from '../lib/types';
import { domains, formatNumber } from '../lib/presentation';
import { Icon } from './Icon';
import { Alert, Button, DistrictSelect, EmptyState } from './ui';

export function ScenarioPanel({ catalog, decisions, preview, fresh, running, runError, run, remove, changeDistrict, reset, loadDemo }: { catalog: Catalog; decisions: Decision[]; preview: Preview; fresh: boolean; running: boolean; runError: string; run: () => void; remove: (id: string) => void; changeDistrict: (id: string, district: Decision['district_id']) => void; reset: () => void; loadDemo: () => void }) {
  const spent = decisions.reduce((sum, decision) => sum + (catalog.initiatives.find((item) => item.id === decision.initiative_id)?.cost ?? 0), 0);
  return <aside className="scenario-panel panel" aria-labelledby="scenario-title">
    <div className="scenario-heading"><div className="scenario-heading-title"><Icon name="list"/><h2 id="scenario-title">Ваш сценарий</h2></div><span className="count-badge">{decisions.length} / 5</span></div>
    <div className="scenario-progress" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < decisions.length ? 'is-complete' : ''}/>)}</div>
    {decisions.length ? <ol className="selected-list">{decisions.map((decision) => {
      const initiative = catalog.initiatives.find((item) => item.id === decision.initiative_id);
      if (!initiative) return <li key={decision.initiative_id}><span>Инициатива больше недоступна</span><Button onClick={() => remove(decision.initiative_id)}>Убрать</Button></li>;
      const domain = domains.find((item) => item.id === initiative.domain)!;
      return <li key={decision.initiative_id} className={`domain-${initiative.domain}`}><div className="selected-item-header"><span className="domain-icon"><Icon name={domain.icon} size={16}/></span><strong>{initiative.name_ru}</strong><button type="button" className="icon-button" aria-label={`Убрать ${initiative.id} из сценария`} onClick={() => remove(initiative.id)}><Icon name="close" size={15}/></button></div><div className="selected-item-detail">{initiative.scope === 'district' ? <DistrictSelect label={`Изменить район ${initiative.id}`} districts={catalog.districts} value={decision.district_id ?? ''} onChange={(district) => changeDistrict(initiative.id, district)} options={preview.replacement_availability[initiative.id]} disabled={!fresh || running}/> : <span><Icon name="city" size={14}/>Весь город</span>}<span className="selected-cost">{initiative.cost} ед.</span></div></li>;
    })}</ol> : <EmptyState title="Пока чистый лист"><p>Добавляйте инициативы из каталога. Здесь появится ваш план для города.</p><Button onClick={loadDemo}><Icon name="spark" size={16}/>Загрузить пример</Button></EmptyState>}
    <div className="scenario-budget"><div><span>Бюджет сценария</span><strong>{spent}<small> / {catalog.budget} ед.</small></strong></div><div className="budget-track" aria-label={`Распределено ${spent} из ${catalog.budget} единиц`} role="meter" aria-valuemin={0} aria-valuemax={catalog.budget} aria-valuenow={spent}>{domains.map((domain) => <span key={domain.id} className={`domain-${domain.id}`} style={{ width: `${decisions.reduce((sum, decision) => { const item = catalog.initiatives.find((initiative) => initiative.id === decision.initiative_id); return sum + (item?.domain === domain.id ? item.cost : 0); }, 0) / catalog.budget * 100}%` }}/>)}</div><p>В резерве <strong>{formatNumber(catalog.budget - spent)} ед.</strong></p></div>
    {!!preview.synergies.length && fresh && <div className="synergy-note"><Icon name="spark" size={17}/><span>Синергия {preview.synergies.map((synergy) => synergy.initiatives.join(' + ')).join(', ')} учтена в прогнозе</span></div>}
    <div className="run-area"><Button variant="primary" busy={running} disabled={!fresh || !preview.complete} onClick={run} className="run-button"><Icon name="play" size={17}/>Запустить симуляцию</Button><p>{running ? 'Рассчитываем результат и готовим разбор…' : !fresh ? 'Ожидаем актуальный прогноз' : decisions.length < 5 ? `Добавьте ещё ${5 - decisions.length} инициатив для запуска` : 'Все правила соблюдены. Сценарий готов.'}</p>{runError && <Alert retry={run}>{runError}</Alert>}</div>
    {!!decisions.length && <button type="button" className="reset-button" onClick={reset}><Icon name="reset" size={14}/>Очистить сценарий</button>}
    <div className="scenario-footnote"><Icon name="shield" size={14}/><span>Ваш выбор сохраняется в этом браузере</span></div>
  </aside>;
}
