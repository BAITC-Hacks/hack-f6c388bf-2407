# Примеры для разработки

Генерация из корня: `python tools/generate_ai_examples.py`.
Скрипт рассчитывает только один фиксированный сценарий по data/ и docs/architecture.md.
Это проверяемые fixtures, не production-движок и не замена backend.

- catalog.json — ответ каталога.
- score_request.json — пять выбранных мер.
- score_success_no_ai.json — полный ответ без объяснения.
- score_success_with_ai.json — тот же расчёт с вручную написанным текстом для UI.
- ai_input.json — отдельный внутренний вход AI с решениями и синергиями.
- error_422.json — ошибка domain_limit (для другого, недопустимого запроса).

Структуры `districts` и `initiative_contributions` включены в HTTP-контракт.
`ai_input.json` показывает явный адаптированный внутренний формат для AI. В
`realized_effects` синергии не дублируются. Вклад в итоговый score
не приписывается каждой мере: штрафы и минимум района делают его нелинейным.
Score округляется до сотых в конце, score_delta считается относительно контрактного
baseline_score=52.56; промежуточные районные scores не округляются.
