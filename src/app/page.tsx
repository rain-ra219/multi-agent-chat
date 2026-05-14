"use client";

import { useState, useEffect } from "react";
import PipelineCanvas from "./PipelineCanvas";

type ModelReply = {
  model: string;
  content: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  model?: string;
  replies?: ModelReply[];
};

type ModelConfig = {
  key: string;
  label: string;
  role: string;
};

const MODELS: ModelConfig[] = [
  { key: "deepseek", label: "DeepSeek", role: "你是一个理性、严谨的技术专家。" },
  { key: "gpt-5.5", label: "GPT-5.5", role: "你是一个务实的产品经理，关注可行性和用户体验。" },
];

const CHAT_MODELS = MODELS.map((m) => m.key);

const STORAGE_KEY = "multi-agent-chat-messages";
const ROLES_STORAGE_KEY = "multi-agent-chat-roles";

export default function Home() {
  const [mode, setMode] = useState<"chat" | "pipeline">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelRoles, setModelRoles] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingModel, setLoadingModel] = useState("");
  const [showRoles, setShowRoles] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setMessages(JSON.parse(saved));

    const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
    if (savedRoles) {
      setModelRoles(JSON.parse(savedRoles));
    } else {
      const defaults: Record<string, string> = {};
      MODELS.forEach((m) => { defaults[m.key] = m.role; });
      setModelRoles(defaults);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (Object.keys(modelRoles).length > 0) {
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(modelRoles));
    }
  }, [modelRoles]);

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
  }

  async function callModel(modelKey: string, messages: Message[]) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model: modelKey,
        systemPrompt: modelRoles[modelKey] || "",
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { model: modelKey, content: `出错了：${data.error}` };
    }
    return { model: modelKey, content: data.choices[0].message.content };
  }

  async function sendMessage(modelKey: string) {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setLoadingModel(modelKey);

    try {
      if (modelKey === "all") {
        const results = await Promise.all(
          CHAT_MODELS.map((key) => callModel(key, newMessages))
        );
        setMessages([
          ...newMessages,
          { role: "assistant", content: "", replies: results },
        ]);
      } else {
        const result = await callModel(modelKey, newMessages);
        setMessages([
          ...newMessages,
          { role: "assistant", content: result.content, model: modelKey },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "网络请求失败，请检查后端是否在运行。", model: modelKey },
      ]);
    } finally {
      setLoading(false);
      setLoadingModel("");
    }
  }

  function modelLabel(key: string) {
    return MODELS.find((m) => m.key === key)?.label || key;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="py-3 px-4 border-b flex items-center gap-6 bg-white">
        <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode("chat")}
            className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
              mode === "chat"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            讨论
          </button>
          <button
            onClick={() => setMode("pipeline")}
            className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
              mode === "pipeline"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            流水线
          </button>
        </div>

        {mode === "chat" && (
          <>
            <button
              onClick={() => setShowRoles(!showRoles)}
              className="text-sm text-blue-500 hover:underline"
            >
              {showRoles ? "收起角色设置" : "角色设置"}
            </button>
            <div className="flex-1" />
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-sm text-red-500 hover:underline"
              >
                清空记录
              </button>
            )}
          </>
        )}
      </header>

      {mode === "chat" ? (
        <>
          {showRoles && (
            <div className="border-b px-4 py-3 space-y-2 bg-zinc-50">
              {MODELS.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-20">{m.label}</span>
                  <input
                    type="text"
                    value={modelRoles[m.key] || ""}
                    onChange={(e) => setModelRoles({ ...modelRoles, [m.key]: e.target.value })}
                    className="flex-1 text-sm border rounded px-2 py-1"
                    placeholder={`设定 ${m.label} 的角色...`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-center text-zinc-400 mt-20">
                输入话题，然后点名一个模型开始讨论
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.replies ? (
                  <div className="w-full grid grid-cols-2 gap-3">
                    {msg.replies.map((r, j) => (
                      <div key={j} className="bg-zinc-100 rounded-lg px-4 py-2 whitespace-pre-wrap">
                        <div className="text-xs font-medium text-blue-500 mb-1">
                          {modelLabel(r.model)} 说：
                        </div>
                        {r.content}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    {msg.model && (
                      <div className="text-xs font-medium text-blue-500 mb-1">
                        {modelLabel(msg.model)} 说：
                      </div>
                    )}
                    {msg.content}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-center text-zinc-400">
                {loadingModel === "all"
                  ? "DeepSeek 和 GPT-5.5 正在发言..."
                  : `${modelLabel(loadingModel)} 正在发言...`}
              </div>
            )}
          </div>

          <div className="border-t p-4 space-y-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <div className="flex gap-2">
              {MODELS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => sendMessage(m.key)}
                  disabled={loading || !input.trim()}
                  className="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
                >
                  点名 {m.label}
                </button>
              ))}
              <button
                onClick={() => sendMessage("all")}
                disabled={loading || !input.trim()}
                className="flex-1 bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm"
              >
                一起回答
              </button>
            </div>
          </div>
        </>
      ) : (
        <PipelineCanvas />
      )}
    </div>
  );
}
