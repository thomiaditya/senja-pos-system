"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OTHER_REASON = "Lainnya";

export const CANCEL_REASON_PRESETS = ["Pelanggan berubah pikiran", "Pesanan salah input", "Menu habis", OTHER_REASON];

export function ReasonDialog({
  title,
  description,
  submitLabel,
  destructive = false,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const inputId = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const needsCustom = choice === OTHER_REASON;
  const reason = needsCustom ? custom.trim() : (choice ?? "");
  const canSubmit = reason !== "";
  const hint = choice === null
    ? "Pilih alasan dulu."
    : needsCustom && reason === ""
      ? "Tulis alasan dulu."
      : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) onSubmit(reason);
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Alasan</span>
            <div className="flex flex-wrap gap-2">
              {CANCEL_REASON_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={choice === preset ? "default" : "outline"}
                  aria-pressed={choice === preset}
                  onClick={() => setChoice(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
          {needsCustom && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={inputId}>Tulis alasan</Label>
              <Input
                id={inputId}
                value={custom}
                placeholder="Contoh: pelanggan pindah meja"
                autoFocus
                onChange={(event) => setCustom(event.target.value)}
              />
            </div>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={!canSubmit}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelReasonDialog({
  orderNumber,
  mode,
  onClose,
  onSubmit,
}: {
  orderNumber: string;
  mode: "cancel" | "request";
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const request = mode === "request";
  return (
    <ReasonDialog
      title={request ? `Ajukan pembatalan ${orderNumber}` : `Batalkan ${orderNumber}`}
      description={request ? "Pengajuan dikirim ke SPV untuk disetujui." : "Pesanan ini akan dibatalkan."}
      submitLabel={request ? "Kirim ke SPV" : "Batalkan pesanan"}
      destructive={!request}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="button" onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
