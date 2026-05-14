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
  const { messages, model, systemPrompt, stream } = await request.json();

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

  const body = {
    model: config.model,
    messages: apiMessages,
    stream: stream ?? false,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey.trim(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return Response.json(
        { error: data.error?.message || "调用 AI 失败" },
        { status: response.status }
      );
    }

    if (stream && response.body) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
