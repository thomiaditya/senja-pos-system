export const QUEUE_WARNING_MS = 5 * 60_000;
export const QUEUE_ALARM_MS = 10 * 60_000;
export const QUEUE_ALARM_REPEAT_MS = 30_000;

export type QueueLevel = "normal" | "warning" | "alarm";

export function isQueueTimedStatus(status: string) {
  return status === "Queued" || status === "Preparing";
}

export function getQueueElapsedMs(createdAt: string, now: number) {
  return Math.max(0, now - Date.parse(createdAt));
}

export function getQueueLevel(createdAt: string, now: number): QueueLevel {
  const elapsed = getQueueElapsedMs(createdAt, now);
  if (elapsed >= QUEUE_ALARM_MS) return "alarm";
  if (elapsed >= QUEUE_WARNING_MS) return "warning";
  return "normal";
}

export function formatQueueElapsed(createdAt: string, now: number) {
  const totalSeconds = Math.floor(getQueueElapsedMs(createdAt, now) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

let alarmAudio: AudioContext | null = null;

// Browsers block audio until a user gesture, so this must be called from a click handler.
export async function enableQueueAlarmSound(): Promise<boolean> {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return false;
  alarmAudio ??= new AudioContextClass();
  if (alarmAudio.state === "suspended") await alarmAudio.resume();
  if (alarmAudio.state !== "running") return false;
  playQueueAlarmBeep();
  return true;
}

export function playQueueAlarmBeep() {
  const audio = alarmAudio;
  if (!audio || audio.state !== "running") return;
  const start = audio.currentTime;
  for (let index = 0; index < 3; index += 1) {
    const at = start + index * 0.3;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.25);
  }
}

// Two rising sine tones, so a new order sounds different from the overdue alarm.
export function playNewOrderChime() {
  const audio = alarmAudio;
  if (!audio || audio.state !== "running") return;
  const start = audio.currentTime;
  [660, 990].forEach((frequency, index) => {
    const at = start + index * 0.18;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.32);
  });
}

