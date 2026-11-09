import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { SerialPort } from "serialport";
import { ApiError } from "@/lib/api";
import type { PrinterSerialPort } from "@/lib/types";

export type PrinterConfig =
  | { mode: "network"; host: string; port: number }
  | { mode: "system"; systemName: string }
  | { mode: "serial"; path: string; baudRate: number };

const NETWORK_TIMEOUT_MS = 5000;
const SYSTEM_TIMEOUT_MS = 10000;
// PowerShell butuh waktu kompilasi Add-Type pada pemanggilan pertama.
const WINDOWS_PRINT_TIMEOUT_MS = 30000;
const SERIAL_TIMEOUT_MS = 10000;

// Port Bluetooth Classic (SPP) di Windows memakai pnpId berawalan BTHENUM.
const BLUETOOTH_PORT_PATTERN = /bthenum|bluetooth/i;

export async function listSerialPorts(): Promise<PrinterSerialPort[]> {
  const ports = await SerialPort.list();
  return ports
    .map((port) => {
      const text = `${port.path} ${port.pnpId ?? ""} ${port.manufacturer ?? ""}`;
      return {
        path: port.path,
        manufacturer: port.manufacturer ?? "",
        isBluetooth: BLUETOOTH_PORT_PATTERN.test(text),
      };
    })
    .sort((a, b) => Number(b.isBluetooth) - Number(a.isBluetooth) || a.path.localeCompare(b.path, undefined, { numeric: true }));
}

export function sendToPrinter(config: PrinterConfig, bytes: Buffer): Promise<void> {
  if (config.mode === "network") return sendOverNetwork(config.host, config.port, bytes);
  if (config.mode === "serial") return sendOverSerial(config.path, config.baudRate, bytes);
  return sendToSystemPrinter(config.systemName, bytes);
}

function sendOverSerial(path: string, baudRate: number, bytes: Buffer) {
  return new Promise<void>((resolve, reject) => {
    const port = new SerialPort({ path, baudRate, autoOpen: false });
    let settled = false;
    const settle = (error?: ApiError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const finish = () => (error ? reject(error) : resolve());
      if (port.isOpen) port.close(() => finish());
      else finish();
    };

    const timer = setTimeout(() =>
      settle(new ApiError(504, `Printer di ${path} tidak merespons.`, "PRINTER_TIMEOUT")), SERIAL_TIMEOUT_MS);
    port.on("error", () =>
      settle(new ApiError(502, `Tidak bisa membuka atau menulis ke port ${path}. Pastikan Bluetooth terhubung.`, "PRINTER_UNREACHABLE")));
    port.open((openError) => {
      if (openError) {
        settle(new ApiError(502, `Tidak bisa membuka port ${path}. Pastikan printer menyala dan sudah dipasangkan.`, "PRINTER_UNREACHABLE"));
        return;
      }
      port.write(bytes, (writeError) => {
        if (writeError) {
          settle(new ApiError(502, `Printer di ${path} menolak data.`, "PRINTER_REJECTED"));
          return;
        }
        // drain menunggu data benar-benar keluar dari buffer OS sebelum port ditutup.
        port.drain((drainError) => settle(drainError
          ? new ApiError(502, `Printer di ${path} menolak data.`, "PRINTER_REJECTED")
          : undefined));
      });
    });
  });
}

function sendOverNetwork(host: string, port: number, bytes: Buffer) {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const settle = (error?: ApiError) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(NETWORK_TIMEOUT_MS, () =>
      settle(new ApiError(504, `Printer di ${host}:${port} tidak merespons.`, "PRINTER_TIMEOUT")));
    socket.once("error", () =>
      settle(new ApiError(502, `Tidak bisa terhubung ke printer di ${host}:${port}.`, "PRINTER_UNREACHABLE")));
    socket.once("connect", () => {
      // end() mengirim data lalu menutup tulis; close menandakan data sudah diterima OS.
      socket.end(bytes);
    });
    socket.once("close", () => settle());
  });
}

// Mengirim byte mentah ke antrian printer Windows lewat winspool (RAW datatype).
// Nama printer dan path file diteruskan lewat environment, bukan disisipkan ke script.
const WINDOWS_RAW_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
public class PosRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string name, out IntPtr hPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOW di);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int count, out int written);

  public static void Send(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
      throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      var doc = new DOCINFOW { pDocName = "POS Kopi Senja", pDataType = "RAW" };
      if (!StartDocPrinter(hPrinter, 1, doc)) throw new Win32Exception(Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(hPrinter)) throw new Win32Exception(Marshal.GetLastWin32Error());
        IntPtr ptr = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, ptr, bytes.Length);
          int written;
          if (!WritePrinter(hPrinter, ptr, bytes.Length, out written) || written != bytes.Length)
            throw new Win32Exception(Marshal.GetLastWin32Error());
        } finally { Marshal.FreeCoTaskMem(ptr); }
        EndPagePrinter(hPrinter);
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
  }
}
"@
[PosRawPrinter]::Send($env:POS_PRINTER_NAME, [System.IO.File]::ReadAllBytes($env:POS_PRINT_FILE))
`;

async function sendToWindowsPrinter(printerName: string, bytes: Buffer) {
  const dir = await mkdtemp(path.join(tmpdir(), "pos-print-"));
  const file = path.join(dir, "job.bin");
  try {
    await writeFile(file, bytes);
    const encoded = Buffer.from(WINDOWS_RAW_PRINT_SCRIPT, "utf16le").toString("base64");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
        {
          stdio: ["ignore", "ignore", "pipe"],
          env: { ...process.env, POS_PRINTER_NAME: printerName, POS_PRINT_FILE: file },
        },
      );
      let stderr = "";
      let settled = false;
      const settle = (error?: ApiError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };

      const timer = setTimeout(() => {
        child.kill();
        settle(new ApiError(504, `Printer Windows "${printerName}" tidak merespons.`, "PRINTER_TIMEOUT"));
      }, WINDOWS_PRINT_TIMEOUT_MS);

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once("error", () =>
        settle(new ApiError(502, "PowerShell tidak tersedia di server Windows.", "PRINTER_UNAVAILABLE")));
      child.once("close", (code) => {
        if (code === 0) {
          settle();
          return;
        }
        const detail = stderr.trim().split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
        settle(new ApiError(
          502,
          `Printer Windows "${printerName}" menolak cetakan${detail ? `: ${detail}` : "."}`,
          "PRINTER_REJECTED",
        ));
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sendToSystemPrinter(systemName: string, bytes: Buffer) {
  if (process.platform === "win32") return sendToWindowsPrinter(systemName, bytes);
  return new Promise<void>((resolve, reject) => {
    const child = spawn("lp", ["-d", systemName, "-o", "raw"], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    const settle = (error?: ApiError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => {
      child.kill();
      settle(new ApiError(504, `Printer sistem "${systemName}" tidak merespons.`, "PRINTER_TIMEOUT"));
    }, SYSTEM_TIMEOUT_MS);

    child.stdin.on("error", () => undefined);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", () =>
      settle(new ApiError(502, "Perintah lp tidak tersedia di server. Pastikan CUPS terpasang.", "PRINTER_UNAVAILABLE")));
    child.once("close", (code) => {
      if (code === 0) {
        settle();
        return;
      }
      const detail = stderr.trim().split("\n")[0];
      settle(new ApiError(
        502,
        `Printer sistem "${systemName}" menolak cetakan${detail ? `: ${detail}` : "."}`,
        "PRINTER_REJECTED",
      ));
    });
    child.stdin.end(bytes);
  });
}
