let audioCtx: AudioContext | null = null;
let master: AudioNode | null = null;

/** Overall loudness. The limiter after it keeps loud peaks from distorting. */
const MASTER_GAIN = 3;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/** Every sound goes through boost -> limiter -> speakers. */
function out(ac: AudioContext): AudioNode {
  if (master) return master;
  const boost = ac.createGain();
  boost.gain.value = MASTER_GAIN;
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  boost.connect(limiter);
  limiter.connect(ac.destination);
  master = boost;
  return master;
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
  gain.connect(out(ac));
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export type NotificationSound = 'created' | 'content' | 'assigned' | 'dueSoon' | 'done' | 'closed';

const POP_RING_S = 0.38;

/** One bright marimba-like note: quick attack, a short ring, and overtones so it carries. */
function pop(frequency: number, start: number, volume = 0.6): void {
  const ac = ctx();
  if (!ac) return;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + POP_RING_S);
  gain.connect(out(ac));

  for (const [mult, level] of [[1, 1], [2, 0.3], [2.76, 0.2], [4, 0.08]] as const) {
    const osc = ac.createOscillator();
    const partial = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * mult * 1.02, start);
    osc.frequency.exponentialRampToValueAtTime(frequency * mult, start + 0.03);
    partial.gain.value = level;
    osc.connect(partial);
    partial.connect(gain);
    osc.start(start);
    osc.stop(start + POP_RING_S + 0.03);
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
  tone(880, t, 0.1, 0.5, 'triangle');
  tone(880, t + 0.16, 0.1, 0.5, 'triangle');
  tone(988, t + 0.32, 0.16, 0.5, 'triangle');
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
