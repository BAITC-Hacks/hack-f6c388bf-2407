import { useRef, useState } from 'react';
import type { Catalog, Decision, DistrictId, Domain, IndicatorCode, Initiative, Preview } from '../lib/types';
import { domains, formatNumber, indicatorLabels, signed } from '../lib/presentation';
import { Icon } from './Icon';
import { Button, DistrictSelect, EmptyState } from './ui';

function InitiativeCard({ initiative, catalog, decisions, preview, busy, add, remove }: { initiative: Initiative; catalog: Catalog; decisions: Decision[]; preview: Preview; busy: boolean; add: (decision: Decision) => void; remove: (id: string) => void }) {
  const [district, setDistrict] = useState<DistrictId | ''>('');
  const selected = decisions.find((decision) => decision.initiative_id === initiative.id);
  const domain = domains.find((item) => item.id === initiative.domain)!;
  const options = preview.availability[initiative.id];
  const scopeKey = initiative.scope === 'citywide' ? 'citywide' : district;
  const reason = selected ? null : scopeKey ? options?.[scopeKey] : 'Выберите район для инициативы';
  const unavailable = !selected && (!!reason || busy || !scopeKey || !options);
  const realized = (catalog.horizon_quarters - initiative.lag_quarters) / catalog.horizon_quarters;
  return <article className={`initiative-card domain-${initiative.domain} ${selected ? 'is-selected' : ''}`} data-testid={`initiative-${initiative.id}`}>
    <div className="initiative-top"><span className="domain-icon"><Icon name={domain.icon}/></span><span className="initiative-id">{initiative.id}</span>{selected ? <span className="selected-badge"><Icon name="check" size={13}/>В сценарии</span> : <span className="scope-badge">{initiative.scope === 'citywide' ? 'Весь город' : 'Один район'}</span>}</div>
    <h3>{initiative.name_ru}</h3>
    <div className="initiative-meta"><span className="initiative-cost">{initiative.cost}<small>ед.</small></span><span><Icon name="clock" size={14}/>Лаг {initiative.lag_quarters} кв.</span></div>
    <div className="initiative-effects" aria-label="Эффект за 8 кварталов">{Object.entries(initiative.effects).map(([code, value]) => <span key={code} className={value! < 0 ? 'effect-negative' : ''} title={catalog.indicators.find((item) => item.code === code)?.description_ru}><strong>{signed(value! * realized, value! * realized % 1 ? 2 : 0)}</strong>{indicatorLabels[code as IndicatorCode]}</span>)}</div>
    <div className="initiative-bottom">{initiative.scope === 'district' ? <DistrictSelect label={`Район для ${initiative.id}`} districts={catalog.districts} value={selected?.district_id ?? district} onChange={setDistrict} disabled={!!selected || busy} options={selected ? undefined : options}/> : <div className="citywide-label"><Icon name="city" size={17}/><span>Эффект во всех 5 районах</span></div>}
      <Button variant={selected ? 'secondary' : 'primary'} disabled={unavailable} aria-describedby={`reason-${initiative.id}`} onClick={() => selected ? remove(initiative.id) : add({ initiative_id: initiative.id, ...(initiative.scope === 'district' && district ? { district_id: district } : {}) })}><Icon name={selected ? 'check' : 'plus'} size={16}/>{selected ? 'Убрать из сценария' : 'Добавить'}</Button>
      <p id={`reason-${initiative.id}`} className={`availability-reason ${reason && scopeKey ? 'has-reason' : ''}`}>{selected ? 'Район можно изменить в вашем сценарии' : busy ? 'Проверяем доступность…' : reason || `Реализуется ${formatNumber(realized * 100)}% полного эффекта`}</p>
    </div>
  </article>;
}

export function InitiativeCatalog({ catalog, decisions, preview, filter, setFilter, busy, add, remove }: { catalog: Catalog; decisions: Decision[]; preview: Preview; filter: Domain | 'all'; setFilter: (filter: Domain | 'all') => void; busy: boolean; add: (decision: Decision) => void; remove: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const initiatives = catalog.initiatives.filter((initiative) => (filter === 'all' || initiative.domain === filter) && (!selectedOnly || decisions.some((decision) => decision.initiative_id === initiative.id)) && `${initiative.name_ru} ${initiative.id}`.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')));
  return <section id="initiatives" className="catalog-section" aria-labelledby="catalog-title">
    <div className="section-heading"><div><span className="eyebrow">ОТ ИДЕИ К ИЗМЕНЕНИЯМ</span><h2 id="catalog-title">Городские инициативы</h2><p>Выберите 5 решений, которые сделают город лучше.</p></div><span className="count-badge">14 проектов</span></div>
    <div className="catalog-filters" role="group" aria-label="Направление инициатив"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Все</button>{domains.map((domain) => <button type="button" key={domain.id} className={`domain-${domain.id}`} aria-pressed={filter === domain.id} onClick={() => setFilter(domain.id)}><Icon name={domain.icon} size={16}/>{domain.short}</button>)}</div>
    <div className="catalog-toolbar"><div className="search-field"><Icon name="search" size={17}/><input ref={searchRef} type="search" aria-label="Поиск инициатив" placeholder="Найти инициативу…" value={query} onChange={(event) => setQuery(event.target.value)}/>{query && <button type="button" className="icon-button" aria-label="Очистить поиск" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><Icon name="close" size={16}/></button>}</div><label className="checkbox-label"><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}/>Выбранные</label></div>
    <p className="catalog-count" role="status">{initiatives.length} из 14 инициатив{filter !== 'all' && ` · ${domains.find((domain) => domain.id === filter)?.description}`}</p>
    {initiatives.length ? <div className="initiative-grid">{initiatives.map((initiative) => <InitiativeCard key={initiative.id} {...{ initiative, catalog, decisions, preview, busy, add, remove }}/>)}</div> : <div className="panel"><EmptyState icon="search" title="Инициативы не найдены"><p>Измените запрос или сбросьте фильтры.</p><Button onClick={() => { setQuery(''); setFilter('all'); setSelectedOnly(false); searchRef.current?.focus(); }}>Сбросить фильтры</Button></EmptyState></div>}
    <div className="catalog-note"><Icon name="info" size={16}/><span>Эффекты уже учитывают лаг за 8 кварталов. Не более 2 инициатив одного направления.</span></div>
  </section>;
}
