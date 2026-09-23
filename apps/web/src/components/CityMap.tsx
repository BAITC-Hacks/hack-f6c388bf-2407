import type { District, DistrictId } from '../lib/types';
import { formatNumber, signed } from '../lib/presentation';
import { Icon } from './Icon';

const shapes = [
  { id: 'saryarka', d: 'M80 66 257 34 335 75 302 174 189 203 62 156Z', x: 194, y: 121 },
  { id: 'baikonur', d: 'M347 75 409 42 538 61 591 152 489 194 318 174Z', x: 445, y: 114 },
  { id: 'almaty', d: 'M599 167 659 220 606 313 477 327 426 252 490 207Z', x: 552, y: 258 },
  { id: 'esil', d: 'M310 208 415 220 461 333 356 384 245 343 209 278Z', x: 331, y: 286 },
  { id: 'nura', d: 'M64 174 185 219 198 291 232 347 141 359 35 290Z', x: 127, y: 282 },
] as const;

export function CityMap({ districts, active, onSelect }: { districts: District[]; active: DistrictId; onSelect: (id: DistrictId) => void }) {
  const selected = districts.find((district) => district.id === active)!;
  return <section className="panel city-panel" aria-labelledby="map-title">
    <div className="panel-heading"><div><div className="eyebrow">ГОРОД В ДЕТАЛЯХ</div><h2 id="map-title">Каждый район имеет значение</h2></div><span className="badge"><span className="status-dot"/>Астана</span></div>
    <div className="city-map">
      <svg viewBox="0 0 700 410" role="img" aria-label="Условная схема пяти районов Астаны. Оценки и выбор района доступны кнопками под схемой.">
        <defs><pattern id="city-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="currentColor" strokeWidth=".6"/></pattern><pattern id="city-blocks" width="32" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)"><rect x="4" y="4" width="19" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth=".7"/></pattern></defs>
        <rect width="700" height="410" fill="url(#city-grid)" className="map-grid"/>
        <path d="M-20 196C88 181 99 237 189 242S285 171 370 193s104 52 168 9S649 146 723 160" className="map-river"/>
        <path d="M0 194C91 183 96 235 189 241S285 172 370 193s104 51 168 9S649 147 700 157" className="map-river-center"/>
        {shapes.map((shape) => {
          const district = districts.find((item) => item.id === shape.id)!;
          return <g key={shape.id} className={`map-district ${shape.id === active ? 'is-active' : ''} ${district.score < 50 ? 'is-vulnerable' : ''}`}>
            <path d={shape.d} className="district-fill"/><path d={shape.d} fill="url(#city-blocks)" className="district-blocks"/>
            <g transform={`translate(${shape.x} ${shape.y})`}><rect x="-56" y="-21" width="112" height="55" rx="9" className="map-label-bg"/><text y="0" textAnchor="middle" className="map-name">{district.name_ru}</text><text y="21" textAnchor="middle" className="map-value">{formatNumber(district.score, 1)} <tspan className="map-unit">/ 100</tspan></text></g>
          </g>;
        })}
        <g transform="translate(394 290)" className="map-landmark"><path d="m-14 52 7-28-6-12 5-9 8-2 8 2 5 9-6 12 7 28M-7 24h14M-11 40h22M0 2v-13M-18 52h36"/><circle cy="-16" r="10"/><path d="M-7-22 7-10m-14 0L7-22"/></g>
        <g transform="translate(650 38)" className="map-compass"><text textAnchor="middle" y="-8">С</text><path d="m0 0-5 17 5-4 5 4L0 0Z"/></g>
        <text x="22" y="394" className="map-caption">УСЛОВНАЯ СХЕМА · СИНТЕТИЧЕСКИЕ ДАННЫЕ</text>
        <text x="593" y="184" className="river-name" transform="rotate(-14 593 184)">Есиль</text>
      </svg>
    </div>
    <div className="district-chips" role="group" aria-label="Выберите район для просмотра">{districts.map((district) => <button type="button" key={district.id} onClick={() => onSelect(district.id)} aria-pressed={active === district.id}>{district.name_ru}{district.delta > 0 && <span>{signed(district.delta, 1)}</span>}</button>)}</div>
    <div className="map-insight"><span className="icon-tile"><Icon name="pin" size={18}/></span><p><strong>{selected.name_ru}</strong><span>{selected.profile_ru}</span></p><span className="population">{formatNumber(selected.population_share * 100)}%<small>населения</small></span></div>
  </section>;
}
