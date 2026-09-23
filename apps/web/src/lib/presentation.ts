import type { Decision, Domain, IndicatorCode } from './types';

export const domains: { id: Domain; name: string; short: string; icon: 'bus' | 'leaf' | 'school' | 'shield' | 'services'; description: string }[] = [
  { id: 'transport', name: 'Транспорт', short: 'Транспорт', icon: 'bus', description: 'Город без лишних минут в пути' },
  { id: 'ecology', name: 'Озеленение', short: 'Озеленение', icon: 'leaf', description: 'Больше зелени, чище воздух' },
  { id: 'social', name: 'Социальная инфраструктура', short: 'Соцсфера', icon: 'school', description: 'Образование и здоровье рядом' },
  { id: 'safety', name: 'Безопасность', short: 'Безопасность', icon: 'shield', description: 'Спокойные улицы и безопасные дороги' },
  { id: 'services', name: 'Городские сервисы', short: 'Сервисы', icon: 'services', description: 'Надёжные сети и отзывчивый город' },
];
export const indicatorLabels: Record<IndicatorCode, string> = {
  T1: 'Разгрузка дорог', T2: 'Общественный транспорт', E1: 'Зелёные зоны', E2: 'Качество воздуха',
  S1: 'Школы и детсады', S2: 'Медицина', B1: 'Безопасность улиц', B2: 'Безопасность дорог', C1: 'Надёжность ЖКХ', C2: 'Обращения жителей',
};
export const formatNumber = (value: number, digits = 0) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
export const signed = (value: number, digits = 2) => `${value >= 0 ? '+' : '−'}${formatNumber(Math.abs(value), digits)}`;
export const demoDecisions: Decision[] = [
  { initiative_id: 'M1', district_id: 'nura' }, { initiative_id: 'M4', district_id: 'saryarka' },
  { initiative_id: 'M8', district_id: 'nura' }, { initiative_id: 'M10', district_id: 'nura' }, { initiative_id: 'M12' },
];
