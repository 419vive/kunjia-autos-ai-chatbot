import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { nanoid } from "nanoid";
import { Car, Phone, MessageCircle } from "lucide-react";

export default function Chat() {
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem("kun-chat-session");
    if (stored) return stored;
    const id = nanoid();
    sessionStorage.setItem("kun-chat-session", id);
    return id;
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "你是崑家汽車的AI智能客服助理。",
    },
  ]);

  const chatMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "抱歉，系統暫時忙碌中。您可以直接撥打 0936-812-818 聯繫賴先生。",
        },
      ]);
    },
  });

  const handleSend = (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
    chatMutation.mutate({
      sessionId,
      message: content,
      channel: "web",
    });
  };

  const suggestedPrompts = useMemo(
    () => [
      "目前有哪些車可以看？",
      "有沒有50萬以下的SUV？",
      "我想找一台省油的家庭用車",
      "Honda CR-V 的詳細資訊",
    ],
    []
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-primary text-primary-foreground">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Car className="h-6 w-6" />
            <div>
              <h1 className="text-base font-semibold leading-tight">
                崑家汽車
              </h1>
              <p className="text-xs opacity-80">AI 智能客服</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="tel:0936812818"
              className="flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/25"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">0936-812-818</span>
            </a>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="container py-4">
        <div className="mx-auto max-w-3xl">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={chatMutation.isPending}
            placeholder="請輸入您想詢問的車輛問題..."
            height="calc(100vh - 8rem)"
            emptyStateMessage="歡迎來到崑家汽車！有什麼我可以幫您的嗎？"
            suggestedPrompts={suggestedPrompts}
            className="border-0 shadow-none"
          />
        </div>
      </div>
    </div>
  );
}
