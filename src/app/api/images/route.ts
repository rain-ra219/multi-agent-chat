export async function POST(request: Request) {
  const { prompt, model, size, format, quality, image } = await request.json();

  const apiKey = process.env.YUNWU_API_KEY;
  const baseUrl = process.env.YUNWU_BASE_URL;

  if (!apiKey || !baseUrl) {
    return Response.json(
      { error: "图片 API 未配置" },
      { status: 500 }
    );
  }

  const isEdit = image && image.length > 0;
  const endpoint = isEdit ? "/v1/images/edits" : "/v1/images/generations";
  const url = baseUrl.trim().replace(/\/+$/, "") + endpoint;

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
      formData.append("n", "1");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + apiKey.trim(),
        },
        body: formData,
      });

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
    };

    if (size) body.size = size;
    if (format) body.format = format;
    if (quality) body.quality = quality;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + apiKey.trim(),
      },
      body: JSON.stringify(body),
    });

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
