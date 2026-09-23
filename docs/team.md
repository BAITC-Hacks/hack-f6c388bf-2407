# Разделение работы

| Участник | Зона | Результат |
| --- | --- | --- |
| Фронт | apps/web/ | Выбор мер, вызов API, показатели, AI-разбор или состояние недоступности |
| Бэк | apps/api/ кроме ai/ и test_ai.py | Каталог, правила, расчёт, endpoint, адаптация результата и вызов AI |
| Ерканат: AI | apps/api/src/akim_api/ai/, test_ai.py, contracts/examples/, tools/generate_ai_examples.py, docs/ai.md, docs/demo.md | Объяснение, отказоустойчивость, примеры и демо |

Общие файлы: contracts/openapi.yaml, apps/api/pyproject.toml, data/.
Изменения общих форматов сообщаем друг другу до интеграции. В этой версии добавлены
схема AIAnalysis и optional dependencies ai/test. main.py и frontend не изменены.
Ветки участников раздельные; чужой каталог без договорённости не переписываем.

Порядок интеграции: frontend работает на JSON-примерах; backend реализует расчёт
по архитектуре; подключает explain_scenario по README; затем вместе проверяем
успех, ошибки правил, include_ai_analysis=false и недоступность провайдера.
Числа не рассчитываются на frontend или внутри AI.
