import type { Catalog, Decision, Preview, ScenarioResult } from './types';

async function request<T>(path: string, signal: AbortSignal, decisions?: Decision[]): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = window.setTimeout(abort, path === 'evaluate' ? 45_000 : 12_000);
  try {
    const response = await fetch(`/api/v1/scenario/${path}`, {
      method: decisions ? 'POST' : 'GET', signal: controller.signal,
      headers: decisions ? { 'Content-Type': 'application/json' } : undefined,
      body: decisions ? JSON.stringify({ decisions, include_ai_analysis: path === 'evaluate' }) : undefined,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 422 && typeof body?.message === 'string' ? body.message : 'Сервис расчёта недоступен. Ваш выбор сохранён. Попробуйте ещё раз.');
    if (!body || typeof body !== 'object') throw new Error('Сервис вернул некорректные данные. Повторите запрос.');
    return body as T;
  } catch (error) {
    if (signal.aborted) throw error;
    if (controller.signal.aborted) throw new Error('Сервис не ответил вовремя. Повторите запрос.');
    if (error instanceof TypeError) throw new Error('Нет соединения с сервисом. Проверьте подключение и повторите запрос.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
export const api = {
  catalog: (signal: AbortSignal) => request<Catalog>('catalog', signal),
  preview: (decisions: Decision[], signal: AbortSignal) => request<Preview>('preview', signal, decisions),
  evaluate: (decisions: Decision[], signal: AbortSignal) => request<ScenarioResult>('evaluate', signal, decisions),
};
