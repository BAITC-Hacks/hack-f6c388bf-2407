import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { demoDecisions } from '../lib/presentation';
import type { Catalog, Decision, Preview, ScenarioResult } from '../lib/types';

const STORAGE_KEY = 'akim-scenario-v1';
const keyFor = (decisions: Decision[]) => JSON.stringify(decisions);
function readDraft(): Decision[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value) || value.length > 5) return [];
    return value.every((item) => item && typeof item === 'object' && typeof item.initiative_id === 'string' && (item.district_id === undefined || typeof item.district_id === 'string')) ? value : [];
  } catch { return []; }
}
const messageFor = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
export interface Notice { text: string; undo?: () => void }

export function useScenario() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>(readDraft);
  const [notice, setNotice] = useState<Notice | null>(() => decisions.length ? { text: 'Восстановлен сценарий, сохранённый в этом браузере.' } : null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [previewState, setPreviewState] = useState<{ key: string; data: Preview } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [resultState, setResultState] = useState<{ key: string; data: ScenarioResult } | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const demoRunRef = useRef(false);
  const mutationLock = useRef(false);
  const runLock = useRef(false);
  const currentKey = keyFor(decisions);
  const currentKeyRef = useRef(currentKey);
  currentKeyRef.current = currentKey;
  const fresh = previewState?.key === currentKey;

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    api.catalog(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setCatalog(data);
      if (currentKeyRef.current === '[]') setPreviewState({ key: '[]', data: data.baseline_result });
    }).catch((error) => { if (!controller.signal.aborted) setCatalogError(messageFor(error)); });
    return () => controller.abort();
  }, [catalogAttempt]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, currentKey); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  }, [currentKey]);

  useEffect(() => {
    if (!storageFailed || !decisions.length) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [storageFailed, decisions.length]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    setPreviewError('');
    api.preview(decisions, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setPreviewState({ key: currentKey, data });
      mutationLock.current = false;
    }).catch((error) => {
      if (!controller.signal.aborted) { setPreviewError(messageFor(error)); mutationLock.current = false; }
    });
    return () => controller.abort();
  }, [catalog, currentKey, previewAttempt]); // decisions are represented by their stable serialized key

  useEffect(() => () => requestRef.current?.abort(), []);

  const replace = useCallback((next: Decision[]) => {
    if (keyFor(next) === currentKeyRef.current) return;
    requestRef.current?.abort();
    runLock.current = false;
    setRunning(false);
    setRunError('');
    setPreviewError('');
    setResultState(null);
    mutationLock.current = true;
    currentKeyRef.current = keyFor(next);
    setDecisions(next);
  }, []);

  function add(decision: Decision) {
    if (!fresh || mutationLock.current || running) return;
    const reason = previewState?.data.availability[decision.initiative_id]?.[decision.district_id ?? 'citywide'];
    if (reason !== null) return;
    replace([...decisions, decision]);
  }
  function remove(id: string) {
    replace(decisions.filter((decision) => decision.initiative_id !== id));
  }
  function changeDistrict(id: string, district: Decision['district_id']) {
    if (!fresh || !district || previewState?.data.replacement_availability[id]?.[district] !== null) return;
    replace(decisions.map((decision) => decision.initiative_id === id ? { ...decision, district_id: district } : decision));
  }
  function replaceWithUndo(next: Decision[], text: string) {
    const previous = decisions;
    replace(next);
    setNotice({ text, undo: () => { replace(previous); setNotice({ text: 'Предыдущий сценарий восстановлен.' }); } });
  }
  async function run() {
    if (!fresh || !previewState?.data.complete || runLock.current || mutationLock.current) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    runLock.current = true;
    setRunning(true);
    setRunError('');
    try {
      const data = await api.evaluate(decisions, controller.signal);
      if (controller.signal.aborted || currentKeyRef.current !== currentKey) return;
      setResultState({ key: currentKey, data });
      setNotice({ text: 'Симуляция завершена. Итоговый Score и разбор готовы.' });
    } catch (error) {
      if (!controller.signal.aborted) setRunError(messageFor(error));
    } finally {
      if (!controller.signal.aborted) { setRunning(false); runLock.current = false; }
    }
  }
  useEffect(() => {
    if (!demoRunRef.current || !fresh || !previewState?.data.complete || running) return;
    demoRunRef.current = false;
    void run();
  }, [fresh, currentKey, running, previewState]);

  function applyScenario(next: Decision[], text: string) {
    replaceWithUndo(next, text);
    window.setTimeout(() => document.getElementById('overview')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  function runDemo() {
    if (keyFor(demoDecisions) === currentKeyRef.current) {
      demoRunRef.current = false;
      void run();
      return;
    }
    demoRunRef.current = true;
    replaceWithUndo(demoDecisions, 'Деморежим запущен: считаем пять решений и готовим полный разбор.');
  }
  return {
    catalog, catalogError, retryCatalog: () => setCatalogAttempt((value) => value + 1), decisions,
    preview: previewState?.data ?? catalog?.baseline_result ?? null, fresh,
    previewError, retryPreview: () => { setPreviewState(null); setPreviewAttempt((value) => value + 1); },
    result: resultState?.key === currentKey ? resultState.data : null,
    running, runError, run, add, remove, changeDistrict,
    reset: () => replaceWithUndo([], 'Сценарий очищен. Можно начать заново.'),
    loadDemo: () => replaceWithUndo(demoDecisions, 'Пример загружен: пять направлений, 79 ед. бюджета.'),
    runDemo, applyScenario,
    notice, setNotice, storageFailed,
  };
}
