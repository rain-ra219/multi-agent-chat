"use client";

import { useState, useEffect, useRef } from "react";
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

type SavedRole = {
  id: string;
  name: string;
  prompt: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

const MODELS: ModelConfig[] = [
  { key: "deepseek", label: "DeepSeek", role: "你是一个理性、严谨的技术专家。" },
  { key: "gpt-5.5", label: "GPT-5.5", role: "你是一个务实的产品经理，关注可行性和用户体验。" },
];

const CHAT_MODELS = MODELS.map((m) => m.key);

const OLD_STORAGE_KEY = "multi-agent-chat-messages";
const SESSIONS_KEY = "chat-sessions";
const ACTIVE_SESSION_KEY = "chat-active-session";
const ROLES_STORAGE_KEY = "multi-agent-chat-roles";
const ROLE_LIBRARY_KEY = "role-library";

function newSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "新对话",
    messages: [],
    createdAt: Date.now(),
  };
}

export default function Home() {
  const [mode, setMode] = useState<"chat" | "pipeline">("pipeline");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [modelRoles, setModelRoles] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingModel, setLoadingModel] = useState("");
  const [showRoles, setShowRoles] = useState(false);
  const [showRoleLibrary, setShowRoleLibrary] = useState(false);

  const [savedRoles, setSavedRoles] = useState<SavedRole[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePrompt, setNewRolePrompt] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, activeSessionId]);

  useEffect(() => {
    const savedSessions = localStorage.getItem(SESSIONS_KEY);
    const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);

    if (savedSessions) {
      const parsed: ChatSession[] = JSON.parse(savedSessions);
      setSessions(parsed);
      if (savedActiveId && parsed.some((s) => s.id === savedActiveId)) {
        setActiveSessionId(savedActiveId);
      } else if (parsed.length > 0) {
        setActiveSessionId(parsed[0].id);
      }
    } else {
      const oldMessages = localStorage.getItem(OLD_STORAGE_KEY);
      if (oldMessages) {
        const s = newSession();
        s.messages = JSON.parse(oldMessages);
        if (s.messages.length > 0) {
          const firstUser = s.messages.find((m) => m.role === "user");
          if (firstUser) s.title = firstUser.content.slice(0, 30);
        }
        setSessions([s]);
        setActiveSessionId(s.id);
        localStorage.removeItem(OLD_STORAGE_KEY);
      } else {
        const s = newSession();
        setSessions([s]);
        setActiveSessionId(s.id);
      }
    }

    const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
    if (savedRoles) {
      setModelRoles(JSON.parse(savedRoles));
    } else {
      const defaults: Record<string, string> = {};
      MODELS.forEach((m) => { defaults[m.key] = m.role; });
      setModelRoles(defaults);
    }

    const savedLibrary = localStorage.getItem(ROLE_LIBRARY_KEY);
    if (savedLibrary) setSavedRoles(JSON.parse(savedLibrary));
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (Object.keys(modelRoles).length > 0) {
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(modelRoles));
    }
  }, [modelRoles]);

  useEffect(() => {
    localStorage.setItem(ROLE_LIBRARY_KEY, JSON.stringify(savedRoles));
  }, [savedRoles]);

  function updateMessages(msgs: Message[] | ((prev: Message[]) => Message[])) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const resolved = typeof msgs === "function" ? msgs(s.messages) : msgs;
        const title =
          s.title === "新对话" && resolved.length > 0
            ? resolved.find((m) => m.role === "user")?.content.slice(0, 30) || "新对话"
            : s.title;
        return { ...s, messages: resolved, title };
      })
    );
  }

  function createNewChat() {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
  }

  function switchSession(id: string) {
    setActiveSessionId(id);
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (id === activeSessionId && next.length > 0) {
        setActiveSessionId(next[0].id);
      } else if (next.length === 0) {
        const s = newSession();
        setActiveSessionId(s.id);
        return [s];
      }
      return next;
    });
  }

  function clearHistory() {
    updateMessages([]);
  }

  function addSavedRole() {
    if (!newRoleName.trim() || !newRolePrompt.trim()) return;
    const role: SavedRole = {
      id: crypto.randomUUID(),
      name: newRoleName.trim(),
      prompt: newRolePrompt.trim(),
    };
    setSavedRoles([...savedRoles, role]);
    setNewRoleName("");
    setNewRolePrompt("");
  }

  function deleteSavedRole(id: string) {
    setSavedRoles(savedRoles.filter((r) => r.id !== id));
  }

  function applyRole(modelKey: string, rolePrompt: string) {
    setModelRoles({ ...modelRoles, [modelKey]: rolePrompt });
  }

  async function streamModel(
    modelKey: string,
    msgs: Message[],
    onChunk: (text: string) => void
  ): Promise<string> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: msgs,
        model: modelKey,
        systemPrompt: modelRoles[modelKey] || "",
        stream: true,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6);
        if (json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(fullText);
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    return fullText;
  }

  async function sendMessage(modelKey: string) {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    updateMessages(newMessages);
    setInput("");
    setLoading(true);
    setLoadingModel(modelKey);

    if (modelKey === "all") {
      const placeholderReplies: ModelReply[] = CHAT_MODELS.map((key) => ({
        model: key,
        content: "",
      }));
      updateMessages([...newMessages, { role: "assistant", content: "", replies: placeholderReplies }]);

      try {
        await Promise.all(
          CHAT_MODELS.map((key, idx) =>
            streamModel(key, newMessages, (text) => {
              updateMessages((prev) => {
                const last = prev[prev.length - 1];
                if (!last?.replies) return prev;
                const updated = [...last.replies];
                updated[idx] = { ...updated[idx], content: text };
                return [...prev.slice(0, -1), { ...last, replies: updated }];
              });
            })
          )
        );
      } catch (err) {
        updateMessages((prev) => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: `出错了：${String(err)}`, replies: undefined }];
        });
      }
    } else {
      updateMessages([...newMessages, { role: "assistant", content: "", model: modelKey }]);

      try {
        await streamModel(modelKey, newMessages, (text) => {
          updateMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last) return prev;
            return [...prev.slice(0, -1), { ...last, content: text }];
          });
        });
      } catch (err) {
        updateMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last) return prev;
          return [...prev.slice(0, -1), { ...last, content: `出错了：${String(err)}` }];
        });
      }
    }

    setLoading(false);
    setLoadingModel("");
  }

  function modelLabel(key: string) {
    return MODELS.find((m) => m.key === key)?.label || key;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="py-3 px-4 border-b flex items-center gap-4 bg-white">
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

        <button
          onClick={() => { setShowRoleLibrary(!showRoleLibrary); setShowRoles(false); }}
          className={`text-sm hover:underline ${showRoleLibrary ? "text-blue-600" : "text-blue-500"}`}
        >
          角色库{savedRoles.length > 0 ? ` (${savedRoles.length})` : ""}
        </button>

        {mode === "chat" && (
          <>
            <button
              onClick={() => { setShowRoles(!showRoles); setShowRoleLibrary(false); }}
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

      {/* 角色库面板 */}
      {showRoleLibrary && (
        <div className="border-b px-4 py-3 bg-zinc-50 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-600">角色库</span>
            <span className="text-xs text-zinc-400">管理预制的角色提示词，聊天和流水线都能使用</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="角色名称"
              className="text-sm border rounded px-2 py-1 w-32"
            />
            <input
              type="text"
              value={newRolePrompt}
              onChange={(e) => setNewRolePrompt(e.target.value)}
              placeholder="角色提示词..."
              className="flex-1 text-sm border rounded px-2 py-1"
            />
            <button
              onClick={addSavedRole}
              disabled={!newRoleName.trim() || !newRolePrompt.trim()}
              className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              保存
            </button>
          </div>

          {savedRoles.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {savedRoles.map((role) => (
                <div key={role.id} className="flex items-start gap-2 bg-white rounded border p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-700 truncate">{role.name}</div>
                    <div className="text-xs text-zinc-400 truncate">{role.prompt.slice(0, 60)}</div>
                  </div>
                  <button
                    onClick={() => deleteSavedRole(role.id)}
                    className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">还没有保存的角色，新建一个吧</p>
          )}
        </div>
      )}

      {mode === "chat" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* 会话列表侧边栏 */}
          <div className="w-52 border-r bg-zinc-50 flex flex-col flex-shrink-0">
            <div className="p-2">
              <button
                onClick={createNewChat}
                className="w-full text-sm bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600"
              >
                + 新对话
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded text-xs cursor-pointer ${
                    s.id === activeSessionId
                      ? "bg-white shadow-sm text-zinc-900 font-medium"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <span className="flex-1 truncate">{s.title}</span>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                      className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 聊天区域 */}
          <div className="flex-1 flex flex-col min-w-0">
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
                    {savedRoles.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) applyRole(m.key, e.target.value);
                          e.target.value = "";
                        }}
                        className="text-xs border rounded px-1 py-1 w-24"
                      >
                        <option value="">选择预制角色</option>
                        {savedRoles.map((r) => (
                          <option key={r.id} value={r.prompt}>{r.name}</option>
                        ))}
                      </select>
                    )}
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
              <div ref={messagesEndRef} />
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
          </div>
        </div>
      ) : (
        <PipelineCanvas savedRoles={savedRoles} />
      )}
    </div>
  );
}
