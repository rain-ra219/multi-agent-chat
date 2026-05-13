"use client"; // 这行告诉 Next.js：这个组件需要在浏览器里运行（有交互逻辑）

import { useState } from "react";

// 定义一条消息长什么样
type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  // messages: 聊天记录数组    setMessages: 修改聊天记录的方法
  const [messages, setMessages] = useState<Message[]>([]);
  // input: 输入框里的文字    setInput: 修改输入框文字的方法
  const [input, setInput] = useState("");
  // loading: 是否正在等 AI 回复
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return; // 空消息或正在加载时不发送

    // 把用户消息加到聊天记录里
    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput(""); // 清空输入框
    setLoading(true);

    try {
      // 调用我们自己的后端 API（不是直接调 DeepSeek）
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
      {/* 顶栏 */}
      <header className="py-4 border-b text-center">
        <h1 className="text-lg font-bold">Multi-Agent Chat</h1>
        <p className="text-sm text-zinc-500">当前连接：DeepSeek</p>
      </header>

      {/* 聊天消息区域 */}
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

      {/* 底部输入栏 */}
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
