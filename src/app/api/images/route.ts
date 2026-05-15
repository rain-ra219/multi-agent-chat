const PROVIDERS: Record<string, { url: string; key: string | undefined }> = {
  t8star: {
    url: (process.env.T8STAR_BASE_URL || "https://ai.t8star.org") + "/v1/images/generations",
    key: process.env.T8STAR_API_KEY,
  },
  yunwu: {
    url: "https://yunwu.ai/v1/images/generations",
    key: "sk-s9QjOkeiQXVyMBhefFkvswJkdCOD6jUmY5ECqd9FpCOMGbrr",
  },
};

export async function POST(request: Request) {
  const { prompt, model, size, quality, image, provider, apiUrl, customHeaders, customBody } = await request.json();

  console.log("[images] received", { provider, model, promptLen: prompt?.length, size, hasImage: !!image, apiUrl: apiUrl?.slice(0, 40) });

  const isEdit = image && image.length > 0;

  let url: string;
  let authHeader: string;

  if (provider && PROVIDERS[provider]) {
    const p = PROVIDERS[provider];
    if (!p.key) {
      return Response.json({ error: `供应商 ${provider} 的 API Key 没配置，请检查 .env.local` }, { status: 500 });
    }
    url = isEdit ? p.url.replace("/generations", "/edits") : p.url;
    authHeader = "Bearer " + p.key;
    console.log("[images] using provider", { provider, url, authPrefix: authHeader.slice(0, 25) + "..." });
  } else if (apiUrl) {
    url = apiUrl;
    authHeader = "";
  } else {
    const apiKey = process.env.YUNWU_API_KEY;
    const baseUrl = process.env.YUNWU_BASE_URL;
    if (!apiKey) {
      return Response.json({ error: "未配置供应商，请选择供应商或设置 API Key" }, { status: 500 });
    }
    if (!baseUrl) {
      return Response.json({ error: "未配置供应商，请设置 YUNWU_BASE_URL" }, { status: 500 });
    }
    const endpoint = isEdit ? "/v1/images/edits" : "/v1/images/generations";
    url = baseUrl.trim().replace(/\/+$/, "") + endpoint;
    authHeader = "Bearer " + apiKey.trim();
  }

  let extraHeaders: Record<string, string> = {};
  if (customHeaders) {
    try { extraHeaders = JSON.parse(customHeaders); } catch {
      return Response.json({ error: "自定义 Headers JSON 格式错误" }, { status: 400 });
    }
  }

  let extraBody: Record<string, unknown> = {};
  if (customBody) {
    try { extraBody = JSON.parse(customBody); } catch {
      return Response.json({ error: "自定义 Body JSON 格式错误" }, { status: 400 });
    }
  }

  try {
    if (isEdit) {
      const formData = new FormData();

      const imageBuffer = Buffer.from(image, "base64");
      const file = new File([imageBuffer], "image.png", { type: "image/png" });
      formData.append("image", file);
      formData.append("prompt", prompt);
      if (model) formData.append("model", model);
      if (size) formData.append("size", size);
      if (quality) formData.append("quality", quality);

      for (const [key, val] of Object.entries(extraBody)) {
        formData.append(key, String(val));
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        ...extraHeaders,
      };
      if (!headers["authorization"] && !headers["Authorization"]) {
        headers["Authorization"] = authHeader;
      }

      const response = await fetch(url, { method: "POST", headers, body: formData });
      const text = await response.text();
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { errMsg = JSON.parse(text).error?.message || text; } catch { errMsg = text.slice(0, 500); }
        return Response.json({ error: errMsg }, { status: response.status });
      }
      return Response.json(JSON.parse(text));
    }

    const body: Record<string, unknown> = {
      model: model || "gpt-image-2",
      prompt,
      n: 1,
      ...extraBody,
    };

    if (size) body.size = size;
    if (quality) body.quality = quality;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extraHeaders,
    };
    if (!headers["authorization"] && !headers["Authorization"]) {
      headers["Authorization"] = authHeader;
    }

    console.log("[images] request", { url, auth: headers["Authorization"]?.slice(0, 30) + "...", bodyKeys: Object.keys(body) });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await response.text();
    console.log("[images] response", { status: response.status, body: text.slice(0, 300) });
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { errMsg = JSON.parse(text).error?.message || text; } catch { errMsg = text.slice(0, 500); }
      return Response.json({ error: errMsg }, { status: response.status });
    }
    return Response.json(JSON.parse(text));
  } catch (err) {
    console.error("[images] fetch error", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
