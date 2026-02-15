"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";
import { useState, useMemo } from "react";
import "katex/dist/katex.min.css";

export default function FullFeaturedChat() {
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
              controls={{
                code: true,
                table: true,
                mermaid: {
                  download: true,
                  copy: true,
                  fullscreen: true,
                  panZoom: true,
                },
              }}
              isAnimating={
                isLoading &&
                index === messages.length - 1 &&
                message.role === "assistant"
              }
              linkSafety={{
                enabled: true,
                onLinkCheck: (url) => {
                  const trusted = ["github.com", "npmjs.com"];
                  const hostname = new URL(url).hostname;
                  return trusted.some((d) => hostname.endsWith(d));
                },
              }}
              plugins={{ code, mermaid, math }}
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
