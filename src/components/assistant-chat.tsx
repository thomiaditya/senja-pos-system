"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, LoaderCircle, Send, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_HISTORY = 12;

const SUGGESTIONS: Record<UserRole, string[]> = {
  admin: [
    "Berapa penjualan hari ini?",
    "Pesanan apa yang sedang aktif?",
    "Bahan apa yang hampir habis?",
    "Siapa yang masih punya kasbon?",
  ],
  cashier: [
    "Berapa penjualan hari ini?",
    "Pesanan apa yang sedang aktif?",
    "Bagaimana status shift saat ini?",
    "Siapa yang masih punya kasbon?",
  ],
  barista: [
    "Pesanan apa yang sedang aktif?",
    "Meja mana yang sedang terisi?",
    "Apa yang harus saya kerjakan sekarang?",
  ],
  kitchen: [
    "Pesanan apa yang sedang aktif?",
    "Meja mana yang sedang terisi?",
    "Apa yang harus saya kerjakan sekarang?",
  ],
};

function trimHistory(messages: ChatMessage[]) {
  const history = messages.slice(-MAX_HISTORY);
  while (history[0]?.role === "assistant") history.shift();
  return history;
}

export function AssistantChat({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: trimHistory(nextMessages) }),
      });
      const data = (await response.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "Asisten AI tidak dapat merespons saat ini.");
      }
      setMessages((current) => [...current, { role: "assistant", content: data.reply ?? "" }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Asisten AI tidak dapat merespons saat ini.");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <Sparkles data-icon="inline-start" />
        Tanya AI
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pr-10">
          <SheetTitle>Asisten AI</SheetTitle>
          <SheetDescription>
            Tanya seputar penjualan, pesanan, meja, dan cara memakai aplikasi. Asisten hanya membaca data.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Coba salah satu pertanyaan ini:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS[role].map((suggestion) => (
                  <Button key={suggestion} type="button" variant="outline" size="sm" onClick={() => void send(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap"
                  : "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap"
              }
            >
              {message.content}
            </div>
          ))}

          {pending && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Sedang berpikir...
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div ref={endRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-4 pt-3 pb-1">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tulis pertanyaan..."
            maxLength={1000}
            disabled={pending}
            className="h-11 px-4"
            aria-label="Pertanyaan untuk asisten AI"
          />
          <Button type="submit" size="icon" className="size-11" disabled={pending || !draft.trim()} aria-label="Kirim">
            <Send />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
