export async function POST(request: Request) {
  const { prompt, model, size, format, quality, image, apiUrl, customHeaders, customBody } = await request.json();

  const apiKey = process.env.YUNWU_API_KEY;
  const baseUrl = process.env.YUNWU_BASE_URL;

  if (!apiKey && !customHeaders) {
    return Response.json(
      { error: "API 未配置：缺少 YUNWU_API_KEY 或自定义 Headers" },
      { status: 500 }
    );
  }

  const isEdit = image && image.length > 0;

  let url: string;
  if (apiUrl) {
    url = apiUrl;
  } else {
    if (!baseUrl) {
      return Response.json(
        { error: "API 未配置：请设置 YUNWU_BASE_URL 或填写自定义 API 地址" },
        { status: 500 }
      );
    }
    const endpoint = isEdit ? "/v1/images/edits" : "/v1/images/generations";
    url = baseUrl.trim().replace(/\/+$/, "") + endpoint;
  }

  // 解析自定义 Headers
  let extraHeaders: Record<string, string> = {};
  if (customHeaders) {
    try { extraHeaders = JSON.parse(customHeaders); } catch {
      return Response.json({ error: "自定义 Headers JSON 格式错误" }, { status: 400 });
    }
  }

  // 解析自定义 Body
  let extraBody: Record<string, unknown> = {};
  if (customBody) {
    try { extraBody = JSON.parse(customBody); } catch {
      return Response.json({ error: "自定义 Body JSON 格式错误" }, { status: 400 });
    }
  }

  try {
    if (isEdit) {
      // 图生图：multipart/form-data
      const formData = new FormData();

      const imageBuffer = Buffer.from(image, "base64");
      const file = new File([imageBuffer], "image.png", { type: "image/png" });
      formData.append("image", file);
      formData.append("prompt", prompt);
      if (model) formData.append("model", model);
      if (size) formData.append("size", size);
      if (quality) formData.append("quality", quality);

      // 合并自定义 body（multipart 下作为额外字段）
      for (const [key, val] of Object.entries(extraBody)) {
        formData.append(key, String(val));
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        ...extraHeaders,
      };
      // 默认 Auth 兜底
      if (!("authorization" in headers || "Authorization" in extraHeaders)) {
        headers["Authorization"] = "Bearer " + apiKey?.trim();
      }

      const response = await fetch(url, { method: "POST", headers, body: formData });

      const text = await response.text();
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { errMsg = JSON.parse(text).error?.message || text.slice(0, 200); } catch { /* raw */ }
        return Response.json({ error: errMsg }, { status: response.status });
      }
      return Response.json(JSON.parse(text));
    }

    // 文生图：JSON
    const body: Record<string, unknown> = {
      model: model || "gpt-image-2",
      prompt,
      n: 1,
      ...extraBody, // 自定义 body 覆盖默认值
    };

    if (size) body.size = size;
    if (format) body.format = format;
    if (quality) body.quality = quality;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extraHeaders,
    };
    if (!("authorization" in headers || "Authorization" in extraHeaders)) {
      headers["Authorization"] = "Bearer " + apiKey?.trim();
    }

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    const text = await response.text();
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { errMsg = JSON.parse(text).error?.message || text.slice(0, 200); } catch { /* raw */ }
      return Response.json({ error: errMsg }, { status: response.status });
    }

    return Response.json(JSON.parse(text));
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
