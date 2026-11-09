"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Coffee, LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginScreen({ next }: { next: string | null }) {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Login tidak berhasil.");
      router.replace(next ?? "/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login tidak berhasil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/15"><Coffee className="size-5" /></div>
          <div className="flex flex-col">
            <strong className="text-lg font-semibold">Kopi Senja</strong>
            <span className="text-xs tracking-widest text-primary-foreground/70">POINT OF SALE</span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <span className="text-xs font-medium tracking-widest text-primary-foreground/70">OPERASIONAL OUTLET</span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Semua pesanan,<br />
            <em className="not-italic text-primary-foreground/80">di satu tempat.</em>
          </h1>
          <p className="max-w-md text-primary-foreground/80">Kelola transaksi, produksi barista dan kitchen, serta stok bahan baku dengan alur yang sederhana.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
          <span className="size-2 rounded-full bg-emerald-300" /> Outlet Kemang <span>•</span> Sistem lokal
        </div>
      </div>

      <section className="flex flex-col justify-between p-6 sm:p-12">
        <Card className="mx-auto w-full max-w-sm gap-6 border-0 p-0 shadow-none ring-0">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Coffee className="size-5" /></div>
            <strong className="text-lg font-semibold">Kopi Senja</strong>
          </div>
          <CardHeader className="gap-1 px-0">
            <span className="text-xs font-medium tracking-widest text-primary">SELAMAT DATANG KEMBALI</span>
            <CardTitle className="text-2xl font-semibold tracking-tight">Masuk ke akun</CardTitle>
            <CardDescription>Gunakan akun demo yang dibuat saat setup database.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="username" className="pl-9" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" className="pl-9" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </div>
              </div>
              <Button className="mt-2 w-full" type="submit" disabled={pending}>
                {pending ? "Memeriksa..." : "Masuk ke POS"}
                {!pending && <ArrowRight data-icon="inline-end" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-xs font-medium tracking-widest text-foreground">
              <span className="size-2 rounded-full bg-emerald-500" /> MODE DEMO
            </div>
            <p>Akun: <b className="font-semibold text-foreground">admin</b>, <b className="font-semibold text-foreground">kasir</b>, <b className="font-semibold text-foreground">barista</b>, atau <b className="font-semibold text-foreground">kitchen</b>. Password ditampilkan sekali saat `pnpm db:setup`.</p>
          </CardFooter>
        </Card>
        <footer className="pt-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} Kopi Senja · POS internal outlet</footer>
      </section>
    </main>
  );
}
