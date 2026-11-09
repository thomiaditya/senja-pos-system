"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { appPath, type AppSection } from "@/lib/app-routes";
import type { UserRole } from "@/lib/types";

type TourStep = {
  section: AppSection;
  roles: UserRole[];
  target: string;
  title: string;
  description: string;
};

const TOUR_EVENT = "kopi-senja-tour-start";
const STEP_KEY_PREFIX = "kopi-senja-tour-step:";

const staff: UserRole[] = ["admin", "cashier"];
const admin: UserRole[] = ["admin"];
const everyone: UserRole[] = ["admin", "cashier", "barista", "kitchen"];

const tourSteps: TourStep[] = [
  { section: "dashboard", roles: staff, target: "sidebar-menu", title: "Menu utama", description: "Semua halaman dibuka dari menu ini. Menu yang tampil menyesuaikan peran akun Anda." },
  { section: "dashboard", roles: staff, target: "dashboard-metrics", title: "Ringkasan hari ini", description: "Penjualan, pesanan aktif, dan bahan yang perlu dicek tampil langsung di sini." },
  { section: "kasir", roles: staff, target: "cashier-menu", title: "Pilih menu", description: "Ketuk produk untuk menambahkannya ke keranjang." },
  { section: "kasir", roles: staff, target: "cashier-cart", title: "Keranjang pesanan", description: "Pilih jenis pesanan dan meja (untuk dine-in), lalu cek totalnya sebelum membayar." },
  { section: "kasir", roles: staff, target: "cashier-checkout", title: "Pembayaran", description: "Isi nama pelanggan, pilih metode bayar, dan diskon bila ada. Pembayaran tunai membutuhkan shift kas yang sudah dibuka." },
  { section: "kas", roles: staff, target: "cash-shift", title: "Shift kas", description: "Catat uang awal laci saat shift dibuka, dan hitung uang fisik saat shift ditutup." },
  { section: "kas", roles: staff, target: "cash-drawer", title: "Buka laci", description: "Laci kasir bisa dibuka dari sini selama printer thermal terhubung." },
  { section: "kas", roles: staff, target: "cash-expenses", title: "Catat pengeluaran", description: "Catat belanja dari laci: siapa PIC-nya, bahan apa yang dibeli, dan berapa harganya. Stok bahan otomatis bertambah." },
  { section: "kas", roles: staff, target: "cash-receivables", title: "Piutang kasbon", description: "Pesanan bayar nanti yang belum lunas tampil di sini. Pembayaran cicilan atau pelunasan dicatat dari sini." },
  { section: "pesanan", roles: everyone, target: "orders-board", title: "Papan pesanan", description: "Pesanan bergerak dari satu kolom ke kolom berikutnya sesuai progres. Pesanan yang menunggu terlalu lama akan diberi peringatan." },
  { section: "menu", roles: admin, target: "menu-catalog", title: "Katalog menu", description: "Ubah harga dan status produk. Perubahan langsung dipakai di kasir." },
  { section: "menu", roles: admin, target: "menu-discount", title: "Master diskon", description: "Buat diskon persentase atau nominal. Kasir memilih diskon saat pembayaran." },
  { section: "inventory", roles: admin, target: "inventory-stock", title: "Stok bahan baku", description: "Pantau stok bahan. Bahan di bawah batas minimum akan ditandai." },
  { section: "inventory", roles: admin, target: "inventory-adjust", title: "Perubahan stok", description: "Catat barang masuk atau koreksi stok opname." },
  { section: "laporan", roles: staff, target: "reports-trend", title: "Tren penjualan", description: "Lihat nilai transaksi per hari untuk membaca performa outlet." },
  { section: "pengaturan", roles: admin, target: "settings-accounts", title: "Kelola akun", description: "Atur ulang password karyawan yang lupa." },
  { section: "pengaturan", roles: admin, target: "settings-printing", title: "Pencetakan nota", description: "Atur lebar kertas printer thermal yang dipakai untuk nota." },
  { section: "pengaturan", roles: admin, target: "settings-kasbon", title: "Batas kasbon", description: "Tentukan batas total piutang per pelanggan." },
  { section: "pengaturan", roles: admin, target: "settings-table-picker", title: "Pemilihan meja", description: "Pilih apakah kasir memakai denah peta atau kartu meja." },
  { section: "pengaturan", roles: admin, target: "settings-printer", title: "Printer thermal", description: "Hubungkan printer Bluetooth dari server, lalu simpan koneksinya." },
];

function hrefFor(step: TourStep, role: UserRole) {
  if (step.section === "pesanan" && (role === "barista" || role === "kitchen")) return `/pesanan/${role}`;
  return appPath({ section: step.section });
}

export function startGuidedTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export function GuidedTour({ role, section }: { role: UserRole; section: AppSection }) {
  const router = useRouter();

  useEffect(() => {
    const steps = tourSteps.filter((step) => step.roles.includes(role));
    const stepKey = `${STEP_KEY_PREFIX}${role}`;
    let stopCurrent: (() => void) | null = null;

    const readStep = () => {
      const raw = window.sessionStorage.getItem(stepKey);
      const value = raw === null ? Number.NaN : Number(raw);
      return Number.isInteger(value) && value >= 0 ? value : null;
    };
    const writeStep = (index: number) => window.sessionStorage.setItem(stepKey, String(index));
    const clearStep = () => window.sessionStorage.removeItem(stepKey);

    // Stopping for navigation or unmount must not end the tour, so the flag suppresses clearStep.
    const stopRunning = () => {
      stopCurrent?.();
      stopCurrent = null;
    };

    function runGroup(index: number) {
      stopRunning();
      let end = index;
      while (end < steps.length && steps[end].section === section) end += 1;
      const group = steps.slice(index, end);
      const isLastGroup = end >= steps.length;
      let stopping = false;

      const advance = (active: Driver, localIndex: number) => {
        if (localIndex < group.length - 1) {
          active.moveNext();
          return;
        }
        if (isLastGroup) {
          active.destroy();
          return;
        }
        writeStep(end);
        stopping = true;
        active.destroy();
        router.push(hrefFor(steps[end], role));
      };

      const instance = driver({
        steps: group.map((step) => ({
          element: `[data-tour="${step.target}"]`,
          popover: { title: step.title, description: step.description },
        })),
        popoverClass: "kopi-tour-popover",
        showProgress: true,
        allowClose: true,
        waitForElement: 3000,
        nextBtnText: "Lanjut",
        prevBtnText: "Kembali",
        doneBtnText: isLastGroup ? "Selesai" : "Lanjut",
        onPopoverRender: (popover, { state }) => {
          popover.progress.textContent = `${index + (state.activeIndex ?? 0) + 1} dari ${steps.length}`;
        },
        onNextClick: (_element, _step, { driver: active, index: localIndex }) => advance(active, localIndex ?? 0),
        onDoneClick: (_element, _step, { driver: active, index: localIndex }) => advance(active, localIndex ?? 0),
        onDestroyed: () => {
          if (!stopping) clearStep();
        },
      });

      stopCurrent = () => {
        stopping = true;
        instance.destroy();
      };
      instance.drive();
    }

    function begin() {
      stopRunning();
      writeStep(0);
      if (steps[0].section !== section) {
        router.push(hrefFor(steps[0], role));
        return;
      }
      runGroup(0);
    }

    function resume() {
      const index = readStep();
      if (index === null) return;
      if (index < steps.length && steps[index].section === section) {
        runGroup(index);
      } else {
        clearStep();
      }
    }

    window.addEventListener(TOUR_EVENT, begin);
    resume();

    return () => {
      window.removeEventListener(TOUR_EVENT, begin);
      stopRunning();
    };
  }, [role, section, router]);

  return null;
}
