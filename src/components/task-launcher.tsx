"use client";

import {
  Ban,
  Armchair,
  ChefHat,
  Compass,
  HandCoins,
  HandPlatter,
  Menu,
  Moon,
  Package,
  Printer,
  Receipt,
  ShieldCheck,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import { startGuidedTask } from "@/components/guided-tour";
import { guidedTasks } from "@/lib/guided-tasks";
import type { UserRole } from "@/lib/types";

const TASK_ICONS: Record<string, LucideIcon> = {
  "layani-pelanggan": HandPlatter,
  "buka-tab-meja": Armchair,
  "ajukan-pembatalan": Ban,
  "setujui-pembatalan": ShieldCheck,
  "buka-shift": Sunrise,
  "tutup-shift": Moon,
  "catat-pengeluaran": Receipt,
  "tagih-kasbon": HandCoins,
  "kerjakan-antrean": ChefHat,
  "atur-menu": Menu,
  "cek-stok": Package,
  "atur-printer": Printer,
};

export function TaskLauncher({ role }: { role: UserRole }) {
  const tasks = guidedTasks.filter((task) => task.roles.includes(role));
  if (tasks.length === 0) return null;

  return (
    <section aria-labelledby="task-launcher-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="task-launcher-title" className="text-lg font-semibold">Mau melakukan apa?</h2>
        <p className="text-sm text-muted-foreground">Pilih tugas, lalu sistem akan memandu langkah demi langkah.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => {
          const Icon = TASK_ICONS[task.id] ?? Compass;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => startGuidedTask(task.id)}
              className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="font-medium">{task.title}</span>
              <span className="text-sm text-muted-foreground">{task.summary}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
