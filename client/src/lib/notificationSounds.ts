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

/** One soft marimba-like note: quick attack, short ring, a touch of overtone. */
function pop(frequency: number, start: number, volume = 0.5): void {
  const ac = ctx();
  if (!ac) return;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
  gain.connect(ac.destination);

  for (const [mult, level] of [[1, 1], [2.76, 0.12]] as const) {
    const osc = ac.createOscillator();
    const partial = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * mult * 1.02, start);
    osc.frequency.exponentialRampToValueAtTime(frequency * mult, start + 0.03);
    partial.gain.value = level;
    osc.connect(partial);
    partial.connect(gain);
    osc.start(start);
    osc.stop(start + 0.25);
  }
}

/** WhatsApp (iPhone)-style two-note "pop-pop" used for task events. */
function playMessageSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  pop(1046.5, t);
  pop(1396.9, t + 0.12);
}

/** Urgent pulse when a task is due in 5 minutes. */
function playDueSoonSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(880, t, 0.08, 0.28);
  tone(880, t + 0.14, 0.08, 0.28);
  tone(988, t + 0.28, 0.12, 0.25);
}

const PLAYERS: Record<NotificationSound, () => void> = {
  created: playMessageSound,
  content: playMessageSound,
  assigned: playMessageSound,
  dueSoon: playDueSoonSound,
  done: playMessageSound,
  closed: playMessageSound,
};

export function playNotificationSound(kind: NotificationSound): void {
  PLAYERS[kind]();
}

export async function playNotificationSounds(kinds: NotificationSound[]): Promise<void> {
  // Until the page has had a click or key press the browser keeps audio locked.
  // Skip rather than queue, so old sounds don't all burst out on the next click.
  if (ctx()?.state !== 'running') return;
  // Several events at once still make one sound, plus the due-soon alert if any.
  const unique = [...new Set(kinds.map((k) => (k === 'dueSoon' ? k : 'content')))];
  for (let i = 0; i < unique.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 320));
    playNotificationSound(unique[i]);
  }
}
