"use client";

import { useState, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// localStorage 的 key，就像给数据起个名字好查找
const STORAGE_KEY = "multi-agent-chat-messages";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // 页面加载时，从 localStorage 恢复聊天记录
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setMessages(JSON.parse(saved)); // 字符串 → 数组
    }
  }, []); // 空数组 = 只在第一次加载时执行

  // 聊天记录变化时，自动存到 localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); // 数组 → 字符串
    }
  }, [messages]); // messages 每次变化都执行

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages([...newMessages, { role: "assistant", content: `出错了：${data.error}` }]);
      } else {
        const reply = data.choices[0].message.content;
        setMessages([...newMessages, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "网络请求失败，请检查后端是否在运行。" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <header className="py-4 border-b text-center relative">
        <h1 className="text-lg font-bold">Multi-Agent Chat</h1>
        <p className="text-sm text-zinc-500">当前连接：DeepSeek</p>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-red-500 hover:underline"
          >
            清空记录
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 mt-20">
            发送一条消息开始对话
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-100 text-zinc-900"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-center text-zinc-400">AI 正在思考...</div>
        )}
      </div>

      <div className="border-t p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="输入消息，按 Enter 发送..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
