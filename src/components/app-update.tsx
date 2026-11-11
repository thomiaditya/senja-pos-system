"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, DownloadCloud, Info, LoaderCircle, RefreshCw } from "lucide-react";
import type { AppUpdateStatus } from "@/lib/app-update";
import { appPath } from "@/lib/app-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

async function fetchUpdateStatus(force: boolean): Promise<AppUpdateStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(`/api/system/update${force ? "?force=1" : ""}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { state: "unavailable", reason: body?.error ?? "Pemeriksaan pembaruan gagal.", checkedAt };
    return body as AppUpdateStatus;
  } catch {
    return { state: "unavailable", reason: "Tidak bisa terhubung ke server.", checkedAt };
  }
}

function useAppUpdateStatus() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback((force: boolean) => {
    setChecking(true);
    return fetchUpdateStatus(force).then(setStatus).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const refresh = () => fetchUpdateStatus(false).then(setStatus);
    refresh();
    const intervalId = window.setInterval(refresh, CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return { status, checking, check };
}

export function AppUpdateBadge() {
  const { status } = useAppUpdateStatus();
  if (status?.state !== "update-available") return null;

  return (
    <Link href={appPath({ section: "pengaturan" })} aria-label="Pembaruan aplikasi tersedia, buka Pengaturan">
      <Badge variant="secondary" className="gap-1">
        <DownloadCloud data-icon="inline-start" />
        Pembaruan tersedia
      </Badge>
    </Link>
  );
}

export function AppUpdateCard() {
  const { status, checking, check } = useAppUpdateStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><RefreshCw className="size-5 text-muted-foreground" /> Pembaruan aplikasi</CardTitle>
        <CardDescription>Sistem memeriksa GitHub otomatis setiap 30 menit. Pembaruan tidak dipasang otomatis agar data outlet tetap aman.</CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" disabled={checking} onClick={() => void check(true)}>
            {checking ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            Periksa sekarang
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <UpdateStatusMessage status={status} />
      </CardContent>
    </Card>
  );
}

function UpdateStatusMessage({ status }: { status: AppUpdateStatus | null }) {
  if (!status) return <p className="text-muted-foreground">Memeriksa pembaruan…</p>;

  const checkedAt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(status.checkedAt));

  if (status.state === "up-to-date") {
    return (
      <>
        <Badge variant="secondary" className="w-fit gap-1"><CircleCheck data-icon="inline-start" /> Sudah terbaru</Badge>
        <p className="text-muted-foreground">Versi terpasang {status.localCommit} pada branch {status.branch}. Diperiksa {checkedAt}.</p>
      </>
    );
  }

  if (status.state === "update-available") {
    return (
      <>
        <Badge className="w-fit gap-1"><DownloadCloud data-icon="inline-start" /> Pembaruan tersedia</Badge>
        <p>Versi terbaru di GitHub: <span className="font-mono">{status.remoteCommit}</span> (terpasang <span className="font-mono">{status.localCommit}</span>).</p>
        <ol className="list-decimal flex flex-col gap-1 pl-5 text-muted-foreground">
          <li>Hentikan server dengan menutup jendela server atau tekan Ctrl+C.</li>
          <li>Jalankan <span className="font-mono">scripts\windows\install.bat</span>. Data outlet tetap tersimpan.</li>
          <li>Jalankan ulang <span className="font-mono">scripts\windows\start-server.bat</span>.</li>
        </ol>
        <p className="text-muted-foreground">Jika installer gagal karena riwayat perubahan berbeda, hubungi teknisi sebelum memperbarui.</p>
      </>
    );
  }

  return (
    <>
      <Badge variant="outline" className="w-fit gap-1"><Info data-icon="inline-start" /> Tidak tersedia</Badge>
      <p className="text-muted-foreground">{status.reason}</p>
    </>
  );
}
