const MODEL_CONFIG: Record<string, { apiKey: string | undefined; baseUrl: string | undefined; model: string }> = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL,
    model: "deepseek-chat",
  },
  "gpt-5.5": {
    apiKey: process.env.YUNWU_API_KEY,
    baseUrl: process.env.YUNWU_BASE_URL,
    model: "gpt-5.5",
  },
};

export async function POST(request: Request) {
  const { messages, model, systemPrompt } = await request.json();

  const selectedModel = model || "deepseek";
  const config = MODEL_CONFIG[selectedModel];

  if (!config) {
    return Response.json(
      { error: `不支持的模型：${selectedModel}` },
      { status: 400 }
    );
  }

  if (!config.apiKey || !config.baseUrl) {
    return Response.json(
      { error: `模型 ${selectedModel} 的 API Key 没配置，请检查 .env` },
      { status: 500 }
    );
  }

  const url = config.baseUrl.trim() + "/v1/chat/completions";

  const apiMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey.trim(),
      },
      body: JSON.stringify({
        model: config.model,
        messages: apiMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || "调用 AI 失败" },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
