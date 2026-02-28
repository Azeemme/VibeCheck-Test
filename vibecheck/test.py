import asyncio

from openai import AsyncOpenAI


async def main():
    client = AsyncOpenAI()  # uses OPENAI_API_KEY from env
    resp = await client.responses.create(
        model="gpt-4o-mini",  # or your OPENAI_MODEL value
        input="Say 'VibeCheck test OK' once.",
    )
    print(resp.output[0].content[0].text)


if __name__ == "__main__":
    asyncio.run(main())
