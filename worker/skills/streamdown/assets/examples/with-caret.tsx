"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";
import { useState, useMemo } from "react";

export default function ChatWithCaret() {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () => new TextStreamChatTransport({ api: "/api/chat" }),
    []
  );
  const { messages, sendMessage, status } = useChat({ transport });
  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={message.id}>
            <Streamdown
              caret="block"
              isAnimating={
                isLoading &&
                index === messages.length - 1 &&
                message.role === "assistant"
              }
              plugins={{ code }}
            >
              {message.parts
                .filter(
                  (p): p is { type: "text"; text: string } =>
                    p.type === "text"
                )
                .map((p) => p.text)
                .join("")}
            </Streamdown>
          </div>
        ))}
      </div>

      <form className="border-t p-4" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-lg border px-4 py-2"
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          value={input}
        />
      </form>
    </div>
  );
}
