import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

export function formatRupiahDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type RupiahInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange" | "min" | "max" | "step"> & {
  value: string;
  onValueChange: (digits: string) => void;
};

// Keeps only digits in state so existing Number(...) parsing still works; display adds "." separators.
export function RupiahInput({ value, onValueChange, ...props }: RupiahInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatRupiahDigits(value)}
      onChange={(event) => onValueChange(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
    />
  );
}
