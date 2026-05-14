"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type NodeData = {
  label: string;
  question?: string;
  model?: string;
  systemPrompt?: string;
  result?: string;
  imageData?: string;
  running?: boolean;
  elapsedMs?: number;
  prompt?: string;
  image?: string;
  size?: string;
};

function InputNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  return (
    <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3 min-w-[180px] shadow-md">
      <div className="text-xs font-bold text-blue-600 mb-1">输入节点</div>
      <div className="text-xs text-zinc-600 max-w-[160px] truncate">
        {d.question || "点击后在右侧编辑问题..."}
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />
    </div>
  );
}

function AgentNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  return (
    <div
      className={`rounded-lg p-3 min-w-[180px] shadow-md border-2 transition-colors ${
        d.running
          ? "bg-yellow-50 border-yellow-400 animate-pulse"
          : "bg-green-50 border-green-400"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-green-500 !border-2 !border-white" />
      <div className="text-xs font-bold text-green-600 mb-1">
        Agent{d.running ? " ⏳" : ""}
      </div>
      <div className="text-xs text-zinc-700 font-medium">{d.label}</div>
      {d.model && <div className="text-[10px] text-zinc-400 mt-0.5">{d.model}</div>}
      {d.elapsedMs != null && (
        <div className="text-[10px] text-zinc-500 mt-0.5">
          耗时 {(d.elapsedMs / 1000).toFixed(1)}s
        </div>
      )}
      {d.result && !d.running && (
        <div className="text-[10px] text-zinc-600 mt-1.5 p-1.5 bg-white rounded border max-h-16 overflow-y-auto leading-relaxed">
          {d.result.slice(0, 120)}{d.result.length > 120 ? "..." : ""}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-green-500 !border-2 !border-white" />
    </div>
  );
}

function OutputNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  return (
    <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-3 min-w-[180px] shadow-md">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white" />
      <div className="text-xs font-bold text-orange-600 mb-1">输出节点</div>
      {d.result ? (
        <div className="text-[10px] text-zinc-700 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
          {d.result}
        </div>
      ) : (
        <div className="text-[10px] text-zinc-400">等待运行...</div>
      )}
    </div>
  );
}

function ImageGenNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  return (
    <div
      className={`rounded-lg p-3 min-w-[200px] shadow-md border-2 ${
        d.running ? "bg-yellow-50 border-yellow-400 animate-pulse" : "bg-purple-50 border-purple-400"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white" />
      <div className="text-xs font-bold text-purple-600 mb-1">
        图片生成{d.running ? " ⏳" : ""}
      </div>
      <div className="text-xs text-zinc-700 font-medium">{d.label}</div>
      {d.elapsedMs != null && (
        <div className="text-[10px] text-zinc-500 mt-0.5">
          耗时 {(d.elapsedMs / 1000).toFixed(1)}s
        </div>
      )}
      {d.imageData && !d.running && (
        <div className="mt-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={d.imageData.startsWith("http") ? d.imageData : `data:image/png;base64,${d.imageData}`}
            alt={d.label}
            className="w-full rounded border max-h-32 object-contain bg-white"
          />
        </div>
      )}
      {d.result && !d.running && !d.imageData && (
        <div className="text-[10px] text-red-500 mt-1.5 p-1 bg-white rounded border">
          {d.result}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white" />
    </div>
  );
}

const nodeTypes = {
  input: InputNode,
  agent: AgentNode,
  image: ImageGenNode,
  output: OutputNode,
};

const STORAGE_KEY = "pipeline-data";
const MODELS = [
  { key: "deepseek", label: "DeepSeek" },
  { key: "gpt-5.5", label: "GPT-5.5" },
];

export default function PipelineCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { nodes: sNodes, edges: sEdges } = JSON.parse(saved);
        if (sNodes) setNodes(sNodes);
        if (sEdges) setEdges(sEdges);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
    }
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const id = crypto.randomUUID();
      const newNode: Node = {
        id,
        type,
        position,
        data: {
          label:
            type === "input" ? "输入" : type === "output" ? "输出" : type === "image" ? "图片生成" : "新 Agent",
          question: "",
          model: "deepseek",
          systemPrompt: "",
          result: "",
          prompt: "",
          image: "",
          size: "1024x1024",
        } satisfies NodeData,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes]
  );

  function updateNodeData(id: string, updates: Partial<NodeData>) {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...(n.data as NodeData), ...updates } };
        }
        return n;
      })
    );
    setSelectedNode((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, data: { ...(prev.data as NodeData), ...updates } };
      }
      return prev;
    });
  }

  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }

  function clearCanvas() {
    localStorage.removeItem(STORAGE_KEY);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setLog([]);
  }

  function getSelectedData(): NodeData {
    return (selectedNode?.data as NodeData) || ({} as NodeData);
  }

  function getExecutionOrder(): Node[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const inputNode = nodes.find((n) => n.type === "input");
    if (!inputNode) return [];

    const order: Node[] = [];
    const visited = new Set<string>();
    const queue = [inputNode.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = nodeMap.get(currentId);
      if (node) order.push(node);

      const outgoing = edges.filter((e) => e.source === currentId);
      for (const edge of outgoing) {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    return order;
  }

  async function runPipeline() {
    setRunning(true);
    setLog([]);

    const order = getExecutionOrder();
    const inputNode = order.find((n) => n.type === "input");
    const inputData = (inputNode?.data as NodeData | undefined);

    if (!inputNode || !inputData?.question) {
      setLog(["错误：请先在输入节点中填写问题"]);
      setRunning(false);
      return;
    }

    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, result: "" } }))
    );

    const messages: { role: string; content: string }[] = [
      { role: "user", content: inputData.question! },
    ];

    const newLog: string[] = ["开始执行流水线..."];

    for (const node of order) {
      if (node.type !== "agent" && node.type !== "image") continue;

      const nd = node.data as NodeData;

      if (node.type === "image") {
        const imagePrompt = nd.prompt || messages.filter((m) => m.role === "assistant").pop()?.content || "";
        newLog.push(`正在生成图片: ${imagePrompt.slice(0, 40)}...`);
        updateNodeData(node.id, { running: true, elapsedMs: undefined });

        const startedAt = performance.now();

        try {
          const imageBody: Record<string, unknown> = {
            prompt: imagePrompt,
            model: "gpt-image-2",
          };
          if (nd.size) imageBody.size = nd.size;
          if (nd.image) imageBody.image = nd.image;

          const response = await fetch("/api/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(imageBody),
          });

          const data = await response.json();
          const elapsed = Math.round(performance.now() - startedAt);

          if (data.error) {
            newLog.push(`  图片生成出错：${data.error}`);
            updateNodeData(node.id, { result: data.error, running: false, elapsedMs: elapsed });
            break;
          }

          const base64 = data.data?.[0]?.b64_json || data.data?.[0]?.url || "";
          if (!base64) {
            newLog.push("  图片生成失败：API 未返回图片数据");
            updateNodeData(node.id, { result: "API 未返回图片数据", running: false, elapsedMs: elapsed });
            break;
          }
          updateNodeData(node.id, { imageData: base64, running: false, elapsedMs: elapsed });
          messages.push({
            role: "assistant",
            content: `[已生成图片，提示词：${imagePrompt}]`,
          });
          newLog.push(`  图片生成完成 (${(elapsed / 1000).toFixed(1)}s)`);

          const hasNext = edges
            .filter((e) => e.source === node.id)
            .some((e) => {
              const target = nodes.find((n) => n.id === e.target);
              return target && (target.type === "agent" || target.type === "output" || target.type === "image");
            });

          if (hasNext) {
            messages.push({
              role: "user",
              content: "请基于上面的内容继续处理，给出你的分析结果。",
            });
          }
        } catch (err) {
          newLog.push(`  图片生成网络错误：${String(err)}`);
          break;
        }
        continue;
      }

      // agent node
      newLog.push(`正在调用 ${nd.label} (${nd.model})...`);
      updateNodeData(node.id, { running: true, elapsedMs: undefined });

      const startedAt = performance.now();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            model: nd.model,
            systemPrompt: nd.systemPrompt || "",
          }),
        });

        const data = await response.json();
        const elapsed = Math.round(performance.now() - startedAt);

        if (data.error) {
          newLog.push(`  ${nd.label} 出错：${data.error}`);
          updateNodeData(node.id, { result: `错误：${data.error}`, running: false, elapsedMs: elapsed });
          break;
        }

        const content = data.choices[0].message.content;
        messages.push({ role: "assistant", content });
        updateNodeData(node.id, { result: content, running: false, elapsedMs: elapsed });
        newLog.push(`  ${nd.label} 完成 (${(elapsed / 1000).toFixed(1)}s)`);

        const hasNext = edges
          .filter((e) => e.source === node.id)
          .some((e) => {
            const target = nodes.find((n) => n.id === e.target);
            return target && (target.type === "agent" || target.type === "output" || target.type === "image");
          });

        if (hasNext) {
          messages.push({
            role: "user",
            content: "请基于上面的内容继续处理，给出你的分析结果。",
          });
        }
      } catch (err) {
        newLog.push(`  ${nd.label} 网络错误：${String(err)}`);
        break;
      }
    }

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const outputNode = order.find((n) => n.type === "output");
    if (outputNode && lastAssistant) {
      updateNodeData(outputNode.id, { result: lastAssistant.content });
    }

    newLog.push("流水线执行完成");
    setLog(newLog);
    setRunning(false);
  }

  return (
    <div className="flex flex-1 h-full">
      <div className="w-36 border-r bg-zinc-50 p-3 space-y-2 flex-shrink-0">
        <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">节点面板</h3>
        {([
          { type: "input", label: "输入", style: "border-blue-300 bg-blue-50 text-blue-700" },
          { type: "agent", label: "Agent", style: "border-green-300 bg-green-50 text-green-700" },
          { type: "image", label: "图片生成", style: "border-purple-300 bg-purple-50 text-purple-700" },
          { type: "output", label: "输出", style: "border-orange-300 bg-orange-50 text-orange-700" },
        ] as const).map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/reactflow", item.type);
              e.dataTransfer.effectAllowed = "move";
            }}
            className={`border-2 rounded-lg p-2.5 text-center text-xs font-medium cursor-grab active:cursor-grabbing ${item.style}`}
          >
            {item.label}
          </div>
        ))}
        <button
          onClick={clearCanvas}
          className="w-full mt-4 text-[11px] text-red-400 hover:text-red-600 hover:underline"
        >
          清空画布
        </button>
      </div>

      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>

      <div className="w-72 border-l bg-zinc-50 p-4 flex-shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase">节点配置</h3>
          <button
            onClick={runPipeline}
            disabled={running}
            className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-green-600 disabled:opacity-50 font-medium"
          >
            {running ? "运行中..." : "运行流水线"}
          </button>
        </div>

        {!selectedNode ? (
          <p className="text-xs text-zinc-400">点击画布上的节点进行配置</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 uppercase">
                {selectedNode.type === "input" ? "输入节点" : selectedNode.type === "agent" ? "Agent 节点" : selectedNode.type === "image" ? "图片生成节点" : "输出节点"}
              </span>
              <button
                onClick={() => deleteNode(selectedNode.id)}
                className="text-[10px] text-red-400 hover:text-red-600"
              >
                删除节点
              </button>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">名称</label>
              <input
                type="text"
                value={getSelectedData().label || ""}
                onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                className="w-full text-xs border rounded px-2 py-1"
              />
            </div>

            {selectedNode.type === "input" && (
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">问题 / 输入内容</label>
                <textarea
                  value={getSelectedData().question || ""}
                  onChange={(e) => updateNodeData(selectedNode.id, { question: e.target.value })}
                  className="w-full text-xs border rounded px-2 py-1 h-24 resize-none"
                  placeholder="输入你要处理的问题..."
                />
              </div>
            )}

            {selectedNode.type === "agent" && (
              <>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">模型</label>
                  <select
                    value={getSelectedData().model || "deepseek"}
                    onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                    className="w-full text-xs border rounded px-2 py-1"
                  >
                    {MODELS.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">系统提示词（角色/任务）</label>
                  <textarea
                    value={getSelectedData().systemPrompt || ""}
                    onChange={(e) => updateNodeData(selectedNode.id, { systemPrompt: e.target.value })}
                    className="w-full text-xs border rounded px-2 py-1 h-28 resize-none"
                    placeholder="例如：你是一个代码审查员，请检查以下代码的问题并提出改进建议。"
                  />
                </div>
                {getSelectedData().result && (
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">运行结果</label>
                    <div className="text-xs text-zinc-700 p-2 bg-white rounded border max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {getSelectedData().result}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedNode.type === "image" && (
              <>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">提示词（描述要生成的图片）</label>
                  <textarea
                    value={getSelectedData().prompt || ""}
                    onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                    className="w-full text-xs border rounded px-2 py-1 h-20 resize-none"
                    placeholder="例如：一只戴着墨镜的柴犬，赛博朋克风格..."
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">参考图片（图生图，可选）</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = (reader.result as string).split(",")[1];
                        updateNodeData(selectedNode.id, { image: base64 });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-[10px]"
                  />
                  {getSelectedData().image && (
                    <div className="mt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${getSelectedData().image}`}
                        alt="参考图"
                        className="w-full rounded border max-h-24 object-contain"
                      />
                      <button
                        onClick={() => updateNodeData(selectedNode.id, { image: "" })}
                        className="text-[10px] text-red-400 hover:text-red-600 mt-1"
                      >
                        清除参考图
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">尺寸</label>
                  <select
                    value={getSelectedData().size || "1024x1024"}
                    onChange={(e) => updateNodeData(selectedNode.id, { size: e.target.value })}
                    className="w-full text-xs border rounded px-2 py-1"
                  >
                    <option value="1024x1024">1024 × 1024</option>
                    <option value="1536x1024">1536 × 1024</option>
                    <option value="1024x1536">1024 × 1536</option>
                    <option value="2048x2048">2048 × 2048</option>
                  </select>
                </div>
                {getSelectedData().imageData && (
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">生成结果</label>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getSelectedData().imageData!.startsWith("http") ? getSelectedData().imageData : `data:image/png;base64,${getSelectedData().imageData}`}
                      alt="生成图片"
                      className="w-full rounded border"
                    />
                  </div>
                )}
                {getSelectedData().result && !getSelectedData().imageData && (
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">错误信息</label>
                    <div className="text-xs text-red-500 p-2 bg-white rounded border">
                      {getSelectedData().result}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedNode.type === "output" && getSelectedData().result && (
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">最终结果</label>
                <div className="text-xs text-zinc-700 p-2 bg-white rounded border max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {getSelectedData().result}
                </div>
              </div>
            )}
          </div>
        )}

        {log.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-bold text-zinc-400 uppercase mb-2">执行日志</h3>
            <div className="space-y-0.5">
              {log.map((line, i) => (
                <div key={i} className={`text-[10px] ${line.startsWith("  ") ? "text-zinc-400 ml-2" : "text-zinc-600 font-medium"}`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
