# Подключение AI к backend

Модуль готов к подключению, но endpoint evaluate пока не реализован в main.py.
Владелец backend подключает его ПОСЛЕ проверки правил и расчёта чисел.

Из корня репозитория:

```powershell
python -m pip install -e './apps/api[ai]'
```

Читается корневой `.env`, независимо от рабочей директории. Переменные окружения
имеют приоритет. Нужны `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
Модель берётся именно из настроек, без скрытой подмены. Она должна поддерживать
Responses API и Structured Outputs; доступность зависит от аккаунта API.
В установленном пакете вне этого репозитория передайте настройки окружением
или явно `AISettings(_env_file='/path/to/.env')`.

Не передавайте весь HTTP-ответ через `ScenarioInput(**result.model_dump())`:
он содержит другие поля. Подготовьте явный объект по `contracts/examples/ai_input.json`.

```python
from akim_api.ai import explain_scenario

# calculated_result — существующий словарь ответа после успешного расчёта.
# decisions_for_ai — пять выбранных мер с названиями, domain, cost из каталога.
# synergies_applied — реально применённые синергии из движка, [] если их нет.
payload = {
    key: calculated_result[key]
    for key in (
        'budget', 'score', 'baseline_score', 'score_delta', 'city_score',
        'weakest_district', 'critical_pairs', 'districts', 'initiative_contributions',
    )
}
payload['decisions'] = decisions_for_ai
payload['synergies_applied'] = synergies_applied
analysis = await explain_scenario(payload, include_ai_analysis=request.include_ai_analysis)
calculated_result['ai_analysis'] = analysis.model_dump() if analysis else None
# Вернуть весь calculated_result: score и прочие поля не теряются при отказе AI.
```

`districts` для этого входа: пять объектов `district_id`, `name_ru`, `before`,
`after` (все десять показателей), `score`. Вклады: `initiative_id`, `district_id`
(null для общегородской меры), `realized_effects` (уже с лагом, без синергий).
Это явный формат передачи в AI. Если движок использует другую структуру,
backend адаптирует её к этой модели; AI не восстанавливает и не пересчитывает числа.
Не заменяйте реальный движок генератором примеров.

Выход: пять текстовых полей по `AIAnalysis` в `contracts/openapi.yaml`, либо null.
Фронт при null показывает «AI-разбор недоступен» и продолжает показывать расчёт.

Проверки без сети и настоящего ключа, из корня:

```powershell
python -m pip install -e './apps/api[ai,test]'
python -m unittest discover -s apps/api/tests -v
```
