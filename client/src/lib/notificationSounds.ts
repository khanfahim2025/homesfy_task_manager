let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/** Call once after user interaction so sounds can play. */
export function unlockNotificationAudio(): void {
  ctx();
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  volume = 0.12,
  type: OscillatorType = 'sine'
): void {
  const ac = ctx();
  if (!ac) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export type NotificationSound = 'created' | 'content' | 'assigned' | 'dueSoon' | 'done' | 'closed';

/** Bright double ping for a new task you're on. */
function playCreatedSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(784, t, 0.1, 0.11);
  tone(988, t + 0.11, 0.12, 0.1);
  tone(1175, t + 0.24, 0.14, 0.09);
}

/** WhatsApp-style pop for new content. */
function playContentSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(660, t, 0.09, 0.1);
  tone(880, t + 0.1, 0.11, 0.1);
}

/** Bitrix-style soft chime for new assignment or added to task. */
function playAssignedSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(587, t, 0.14, 0.11);
  tone(740, t + 0.12, 0.16, 0.1);
  tone(880, t + 0.26, 0.2, 0.09);
}

/** Urgent pulse when a task is due in 5 minutes. */
function playDueSoonSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(880, t, 0.08, 0.12);
  tone(880, t + 0.14, 0.08, 0.12);
  tone(988, t + 0.28, 0.12, 0.11);
}

/** Upward chime when a task is marked done. */
function playDoneSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(523, t, 0.12, 0.1);
  tone(659, t + 0.1, 0.14, 0.1);
  tone(784, t + 0.22, 0.18, 0.09);
}

/** Short low tone when a task is closed. */
function playClosedSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(440, t, 0.18, 0.1);
  tone(330, t + 0.14, 0.22, 0.09);
}

const PLAYERS: Record<NotificationSound, () => void> = {
  created: playCreatedSound,
  content: playContentSound,
  assigned: playAssignedSound,
  dueSoon: playDueSoonSound,
  done: playDoneSound,
  closed: playClosedSound,
};

export function playNotificationSound(kind: NotificationSound): void {
  PLAYERS[kind]();
}

export async function playNotificationSounds(kinds: NotificationSound[]): Promise<void> {
  const unique = [...new Set(kinds)];
  for (let i = 0; i < unique.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 320));
    playNotificationSound(unique[i]);
  }
}
