from .schema import AIAnalysis
from .settings import AISettings


async def call_llm(system: str, user: str, settings: AISettings) -> AIAnalysis | None:
    # Optional dependency: the simulator can run without installing the AI extra.
    from openai import AsyncOpenAI

    async with AsyncOpenAI(
        api_key=settings.openai_api_key.get_secret_value(),
        base_url="https://api.openai.com/v1",
        timeout=settings.ai_timeout_seconds,
        max_retries=0,
    ) as client:
        response = await client.responses.parse(
            model=settings.openai_model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            text_format=AIAnalysis,
            max_output_tokens=settings.ai_max_output_tokens,
            store=False,
        )
    if response.status != "completed":
        return None
    return response.output_parsed
