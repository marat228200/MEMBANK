const MODEL = "claude-haiku-4-5-20251001";

export async function moderateImage(imageData) {
  let contentBlock;
  if (imageData.startsWith("data:")) {
    const match = imageData.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return { flagged: false, reason: "" };
    contentBlock = {
      type: "image",
      source: { type: "base64", media_type: match[1], data: match[2] },
    };
  } else {
    contentBlock = { type: "image", source: { type: "url", url: imageData } };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY не задан в переменных окружения");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text:
                'Ты модератор публичного мем-сайта. Проверь изображение на наличие: нацистской или иной экстремистской символики (включая свастику), пропаганды ненависти по религиозному или этническому признаку (исламофобия, антисемитизм, христианофобия и т.п.), расизма, символики хейт-групп или террористических организаций. Обычные шутки, сатира и мемы без символики ненависти — это нормально, не блокируй их. Ответь СТРОГО в формате JSON без markdown и пояснений: {"flagged": true или false, "reason": "краткая причина на русском, если flagged true, иначе пустая строка"}',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = (data.content || []).map((b) => b.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  return { flagged: !!parsed.flagged, reason: parsed.reason || "" };
}
