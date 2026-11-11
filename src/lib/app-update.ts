import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

export type AppUpdateStatus =
  | { state: "up-to-date"; branch: string; localCommit: string; remoteCommit: string; checkedAt: string }
  | { state: "update-available"; branch: string; localCommit: string; remoteCommit: string; checkedAt: string }
  | { state: "unavailable"; reason: string; checkedAt: string };

let cache: { status: AppUpdateStatus; expiresAt: number } | null = null;

// Hasil dicache agar setiap halaman tidak memanggil GitHub. `force` dipakai tombol "Periksa sekarang".
export async function getAppUpdateStatus({ force = false }: { force?: boolean } = {}): Promise<AppUpdateStatus> {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.status;
  const status = await checkAppUpdate(process.cwd());
  cache = { status, expiresAt: Date.now() + CACHE_TTL_MS };
  return status;
}

export async function checkAppUpdate(cwd: string): Promise<AppUpdateStatus> {
  const checkedAt = new Date().toISOString();
  const unavailable = (reason: string): AppUpdateStatus => ({ state: "unavailable", reason, checkedAt });

  try {
    const branch = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch === "HEAD") return unavailable("Repo tidak berada di branch, sehingga pembaruan tidak bisa diperiksa.");

    const localCommit = await git(cwd, ["rev-parse", "HEAD"]);
    const remoteRef = await git(cwd, ["ls-remote", "origin", `refs/heads/${branch}`]);
    const remoteCommit = remoteRef.split(/\s+/)[0] ?? "";
    if (!remoteCommit) return unavailable(`Branch ${branch} tidak ditemukan di remote origin.`);

    const remoteIncluded = await isAncestor(cwd, remoteCommit);
    return {
      state: remoteIncluded ? "up-to-date" : "update-available",
      branch,
      localCommit: localCommit.slice(0, 7),
      remoteCommit: remoteCommit.slice(0, 7),
      checkedAt,
    };
  } catch (error) {
    console.error("Pemeriksaan pembaruan aplikasi gagal.", error);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return unavailable("Git tidak ditemukan di server. Pembaruan otomatis membutuhkan Git.");
    }
    return unavailable("Tidak bisa memeriksa pembaruan. Pastikan folder aplikasi adalah repo Git dan server terhubung ke internet.");
  }
}

// Commit remote yang sudah menjadi leluhur HEAD berarti lokal sama atau lebih baru.
// Commit yang belum ada di repo lokal (git exit 128) juga berarti ada pembaruan.
async function isAncestor(cwd: string, commit: string) {
  try {
    await git(cwd, ["merge-base", "--is-ancestor", commit, "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

async function git(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}
