export async function POST(request: Request) {
  const { messages } = await request.json();

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL;

  if (!apiKey) {
    return Response.json(
      { error: "API Key 没配置，请检查 .env.local" },
      { status: 500 }
    );
  }

  const url = String(baseUrl).trim() + "/v1/chat/completions";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + String(apiKey).trim(),
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
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
