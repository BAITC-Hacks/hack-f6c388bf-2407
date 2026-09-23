import { useEffect, useId } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { DistrictCatalogItem, DistrictId } from '../lib/types';
import type { Notice } from '../hooks/useScenario';
import { Icon } from './Icon';

export function Button({ children, variant = 'secondary', busy = false, className = '', disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; busy?: boolean }) {
  return <button type="button" className={`button button-${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>{busy && <span className="spinner" aria-hidden="true"/>}{children}</button>;
}
export function DistrictSelect({ districts, value, onChange, disabled, options, label = 'Район' }: { districts: DistrictCatalogItem[]; value: DistrictId | ''; onChange: (value: DistrictId) => void; disabled?: boolean; options?: Record<string, string | null>; label?: string }) {
  const id = useId();
  return <div className="district-select"><label htmlFor={id}>{label}</label><div><Icon name="pin" size={15}/><select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as DistrictId)}>
    <option value="" disabled>Выберите район</option>
    {districts.map((district) => <option key={district.id} value={district.id} disabled={!!options?.[district.id]}>{district.name_ru}{options?.[district.id] ? ' · недоступно' : ''}</option>)}
  </select></div></div>;
}
export function Alert({ children, retry, tone = 'error' }: { children: ReactNode; retry?: () => void; tone?: 'error' | 'info' }) {
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon name={tone === 'error' ? 'warning' : 'info'}/><div>{children}</div>{retry && <Button onClick={retry}>Повторить</Button>}</div>;
}
export function Toast({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  useEffect(() => {
    if (!notice || notice.undo) return;
    const timer = window.setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [notice, onClose]);
  return <div className="toast-region" aria-live="polite" aria-atomic="true">{notice && <div className="toast"><Icon name="check"/><span>{notice.text}</span>{notice.undo && <button type="button" onClick={notice.undo}>Отменить</button>}<button type="button" className="icon-button" aria-label="Закрыть уведомление" onClick={onClose}><Icon name="close" size={17}/></button></div>}</div>;
}
export function EmptyState({ icon = 'list', title, children }: { icon?: 'list' | 'search' | 'spark'; title: string; children: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={26}/></span><h3>{title}</h3><div>{children}</div></div>;
}
