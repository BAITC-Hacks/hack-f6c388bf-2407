# Подключение AI к backend

AI-модуль подключён к `POST /api/v1/scenario/evaluate`. Backend сначала
детерминированно проверяет решения и рассчитывает все числовые показатели, затем
передаёт явный адаптированный контракт модели. Если AI отключён или недоступен,
полный расчёт всё равно возвращается вместе с детерминированным `model_analysis`.

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

`districts` для этого входа: пять объектов `district_id`, `name_ru`, `before`,
`after` (все десять показателей), `score`. Вклады: `initiative_id`, `district_id`
(null для общегородской меры), `realized_effects` (уже с лагом, без синергий).
Это явный формат передачи в AI; адаптер `apps/api/src/akim_api/analysis.py`
собирает его из результата движка. AI не восстанавливает и не пересчитывает числа.

Выход: пять текстовых полей по `AIAnalysis` в `contracts/openapi.yaml`, либо null.
Фронт при null показывает «AI-разбор недоступен» и продолжает показывать расчёт.

Проверки без сети и настоящего ключа, из корня:

```powershell
python -m pip install -e './apps/api[ai,test]'
python -m unittest discover -s apps/api/tests -v
```
