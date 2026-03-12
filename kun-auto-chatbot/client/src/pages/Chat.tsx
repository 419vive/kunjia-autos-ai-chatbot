import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { nanoid } from "nanoid";
import { Car, Phone } from "lucide-react";

export default function Chat() {
  // Read vehicle context from URL params (from VehicleLanding → Chat flow)
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const vehicleContext = urlParams.get("vehicle");
  const prefilledMessage = urlParams.get("message");

  const [sessionId] = useState(() => {
    const stored = localStorage.getItem("kun-chat-session");
    if (stored) return stored;
    const id = nanoid();
    localStorage.setItem("kun-chat-session", id);
    return id;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem("kun-chat-messages");
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (parsed.length > 1) return parsed;
      }
    } catch { /* ignore */ }
    return [{ role: "system", content: "你是崑家汽車的AI智能客服助理。" }];
  });

  // Persist messages
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem("kun-chat-messages", JSON.stringify(messages));
    }
  }, [messages]);

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

  // Auto-send prefilled message from VehicleLanding (once)
  const [autoSent, setAutoSent] = useState(false);
  useEffect(() => {
    if (prefilledMessage && !autoSent) {
      setAutoSent(true);
      // Small delay so the UI renders first
      setTimeout(() => handleSend(prefilledMessage), 300);
    }
  }, [prefilledMessage, autoSent]);

  const suggestedPrompts = useMemo(
    () =>
      vehicleContext
        ? [
            `${vehicleContext} 多少錢？`,
            `我想預約看 ${vehicleContext}`,
            `${vehicleContext} 有什麼配備？`,
          ]
        : [
            "目前有哪些車可以看？",
            "有沒有50萬以下的SUV？",
            "我想找一台省油的家庭用車",
            "Honda CR-V 的詳細資訊",
          ],
    [vehicleContext]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-primary text-primary-foreground">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Car className="h-6 w-6" />
              <div>
                <h1 className="text-base font-semibold leading-tight">
                  崑家汽車
                </h1>
                <p className="text-xs opacity-80">
                  {vehicleContext ? `正在詢問：${vehicleContext}` : "AI 智能客服"}
                </p>
              </div>
            </a>
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
            placeholder={vehicleContext ? `詢問 ${vehicleContext} 的問題...` : "請輸入您想詢問的車輛問題..."}
            height="calc(100vh - 8rem)"
            emptyStateMessage={vehicleContext ? `想了解 ${vehicleContext} 嗎？選個問題或直接打字！` : "歡迎來到崑家汽車！有什麼我可以幫您的嗎？"}
            suggestedPrompts={suggestedPrompts}
            className="border-0 shadow-none"
          />
        </div>
      </div>
    </div>
  );
}
