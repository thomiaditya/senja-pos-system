"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Coffee, LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

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
    <main className="login-page">
      {/* <Toaster richColors /> */}
      <div className="login-showcase">
        <div className="login-brand">
          <div className="brand-icon"><Coffee size={23} /></div>
          <div><strong>Kopi Senja</strong><span>POINT OF SALE</span></div>
        </div>
        <div className="login-message">
          <span className="eyebrow">OPERASIONAL OUTLET</span>
          <h1>Semua pesanan,<br /><em>di satu tempat.</em></h1>
          <p>Kelola transaksi, produksi barista dan kitchen, serta stok bahan baku dengan alur yang sederhana.</p>
        </div>
        <div className="login-showcase-footer">
          <span className="live-dot" /> Outlet Kemang <span>•</span> Sistem lokal
        </div>
      </div>

      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <div className="brand-icon"><Coffee size={21} /></div>
            <strong>Kopi Senja</strong>
          </div>
          <span className="eyebrow">SELAMAT DATANG KEMBALI</span>
          <h2>Masuk ke akun</h2>
          <p className="login-caption">Gunakan akun demo yang dibuat saat setup database.</p>
          <form onSubmit={submit} className="login-form">
            <label htmlFor="username">Username</label>
            <div className="login-input-wrap">
              <UserRound size={17} />
              <Input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </div>
            <label htmlFor="password">Password</label>
            <div className="login-input-wrap">
              <LockKeyhole size={17} />
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <Button className="login-submit" type="submit" disabled={pending}>
              {pending ? "Memeriksa..." : "Masuk ke POS"}
              {!pending && <ArrowRight size={17} />}
            </Button>
          </form>
          <div className="demo-hint">
            <div><span className="live-dot" /> MODE DEMO</div>
            <p>Akun: <b>admin</b>, <b>kasir</b>, <b>barista</b>, atau <b>kitchen</b>. Password ditampilkan sekali saat `pnpm db:setup`.</p>
          </div>
        </div>
        <footer className="login-copyright">© {new Date().getFullYear()} Kopi Senja · POS internal outlet</footer>
      </section>
    </main>
  );
}
