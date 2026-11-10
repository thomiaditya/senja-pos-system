"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Compass, LoaderCircle, Send, Sparkles } from "lucide-react";
import { startGuidedTask } from "@/components/guided-tour";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { guidedTasks } from "@/lib/guided-tasks";
import type { UserRole } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant"; content: string; tasks?: string[] };

type StreamLine =
  | { type: "delta"; text: string }
  | { type: "task"; taskId: string }
  | { type: "done" }
  | { type: "error"; error: string; code?: string };

const MAX_HISTORY = 12;
const GUIDE_PROMPT = "Pandu saya, sebaiknya saya mulai dari mana sekarang?";

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
  const history = messages.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content }));
  while (history[0]?.role === "assistant") history.shift();
  return history;
}

function appendToLastAssistant(messages: ChatMessage[], text: string) {
  const next = [...messages];
  const last = next.at(-1);
  if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + text };
  return next;
}

function addTaskToLastAssistant(messages: ChatMessage[], taskId: string) {
  const next = [...messages];
  const last = next.at(-1);
  if (last?.role === "assistant") next[next.length - 1] = { ...last, tasks: [...(last.tasks ?? []), taskId] };
  return next;
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>,
  h1: ({ children }) => <p className="mt-2 font-semibold first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-2 font-semibold first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-2 font-semibold first:mt-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">{children}</code>,
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
};

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

  function startTask(taskId: string) {
    setOpen(false);
    // Beri waktu sheet menutup agar overlay panduan tidak tertutup olehnya.
    window.setTimeout(() => startGuidedTask(taskId), 200);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setPending(true);

    let receivedDone = false;
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: trimHistory(nextMessages) }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Asisten AI tidak dapat merespons saat ini.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!line) continue;

          const event = JSON.parse(line) as StreamLine;
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "done") receivedDone = true;
          if (event.type === "delta") setMessages((current) => appendToLastAssistant(current, event.text));
          if (event.type === "task") setMessages((current) => addTaskToLastAssistant(current, event.taskId));
        }
      }
      if (!receivedDone) throw new Error("Jawaban asisten terputus. Coba kirim ulang pertanyaan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Asisten AI tidak dapat merespons saat ini.");
    } finally {
      // Balon kosong dibuang jika jawaban gagal sebelum sempat tampil.
      setMessages((current) => {
        const last = current.at(-1);
        return last?.role === "assistant" && !last.content && !last.tasks?.length ? current.slice(0, -1) : current;
      });
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
                <Button type="button" variant="default" size="sm" onClick={() => void send(GUIDE_PROMPT)}>
                  <Compass data-icon="inline-start" />
                  Pandu saya
                </Button>
                {SUGGESTIONS[role].map((suggestion) => (
                  <Button key={suggestion} type="button" variant="outline" size="sm" onClick={() => void send(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            if (message.role === "assistant" && !message.content && !message.tasks?.length) return null;
            const tasks = (message.tasks ?? []).flatMap((taskId) => {
              const task = guidedTasks.find((candidate) => candidate.id === taskId);
              return task ? [task] : [];
            });
            return (
              <div key={index} className={message.role === "user" ? "ml-auto flex max-w-[85%] flex-col items-end gap-2" : "mr-auto flex max-w-[85%] flex-col items-start gap-2"}>
                {(message.role === "user" || message.content) && (
                  <div
                    className={
                      message.role === "user"
                        ? "rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-primary-foreground"
                        : "rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm break-words"
                    }
                  >
                    {message.role === "user" ? (
                      message.content
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                )}
                {tasks.map((task) => (
                  <Button key={task.id} type="button" variant="outline" size="sm" onClick={() => startTask(task.id)}>
                    <Compass data-icon="inline-start" />
                    Mulai panduan: {task.title}
                  </Button>
                ))}
              </div>
            );
          })}

          {pending && !messages.at(-1)?.content && (
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
