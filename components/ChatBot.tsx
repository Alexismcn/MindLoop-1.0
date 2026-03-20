"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Minus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useChatContext } from "@/lib/chat-context";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MISTRAL_API_KEY = "2LitVaCxXcwT2RYBz63xKEoPxGHcgAKJ";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are MindScope Assistant, a compassionate mental health information chatbot embedded in the MindScope app — a platform offering validated self-assessment tools for mental health awareness.

Your role:
- Answer questions about mental health conditions, symptoms, coping strategies, and treatments
- Help users understand their assessment results (PHQ-9, GAD-7, ASRS, PCL-5, etc.)
- Explain psychological concepts in accessible, non-clinical language
- Provide psychoeducation about depression, anxiety, ADHD, PTSD, burnout, sleep issues, and related topics
- Gently suggest professional help when appropriate

Critical rules:
- You are NOT a therapist and NEVER provide diagnosis or treatment
- Always recommend consulting a mental health professional for personal concerns
- If someone expresses suicidal ideation or crisis, IMMEDIATELY urge them to contact emergency services or a crisis line and stop the conversation
- Never give specific medication advice
- Keep answers clear, warm, and evidence-based
- Respond in the same language as the user's question

Always remind users: "I'm an educational assistant, not a substitute for professional care."`;

export function ChatBot() {
  const { t } = useI18n();
  const { chatOpen, setChatOpen } = useChatContext();
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: t.chat.welcome },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile (<640px = Tailwind sm breakpoint)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Desktop drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Init desktop position
  useEffect(() => {
    if (!initialized.current && !isMobile) {
      initialized.current = true;
      setPosition({ x: window.innerWidth - 400 - 24, y: window.innerHeight - 560 - 24 });
    }
  }, [isMobile]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Reset minimized when closed
  useEffect(() => {
    if (!chatOpen) setMinimized(false);
  }, [chatOpen]);

  // Desktop drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, textarea, input")) return;
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };
    const onMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [isDragging]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    setLoading(true);
    try {
      const res = await fetch(MISTRAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...newMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? t.chat.error;
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: t.chat.error }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const inputArea = (
    <div className="flex items-end gap-2 p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t.chat.placeholder}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-28 overflow-y-auto"
        style={{ cursor: "text" }}
        onMouseDown={(e) => e.stopPropagation()}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
        }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); sendMessage(); }}
        disabled={!input.trim() || loading}
        className="flex-shrink-0 h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
        aria-label={t.chat.send}
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );

  const messagesList = (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
            msg.role === "user"
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-bl-sm"
          }`}>
            {msg.content}
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-slate-500 dark:text-slate-400 italic">
            {t.chat.thinking}
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  // ── MOBILE: full-screen bottom sheet ──────────────────────────────────────
  if (isMobile) {
    if (!chatOpen) return null;
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 z-[9998] animate-fade-in"
          onClick={() => setChatOpen(false)}
        />
        {/* Sheet */}
        <div
          className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col rounded-t-3xl bg-white dark:bg-slate-800 shadow-2xl animate-sheet-up"
          style={{ height: "90dvh", maxHeight: "90dvh" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-none">{t.chat.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.chat.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Messages */}
          {messagesList}
          {/* Input — elevated above keyboard on iOS */}
          <div className="flex-shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            {inputArea}
          </div>
        </div>
      </>
    );
  }

  // ── DESKTOP: floating bubble + draggable panel ────────────────────────────
  if (!chatOpen) {
    return (
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{ position: "fixed", left: position.x, top: position.y, zIndex: 9999, width: 400, cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={onMouseDown}
      className="rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden select-none flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <div>
            <p className="text-sm font-semibold leading-none">{t.chat.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{t.chat.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
            className="p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setChatOpen(false); }}
            className="p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="h-80 flex flex-col overflow-hidden">
            {messagesList}
          </div>
          {inputArea}
        </>
      )}
    </div>
  );
}
