/**
 * Sound Service for CRM Notifications
 * Plays dedicated MP3 audio files:
 *  - /sounds/new-lead.mp3 for fresh leads
 *  - /sounds/booking.mp3 for confirmed bookings
 * Automatically falls back to Web Audio API chimes if playback is blocked or file is missing.
 */

let newLeadAudio: HTMLAudioElement | null = null;
let bookingAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

if (typeof window !== 'undefined') {
  try {
    newLeadAudio = new Audio('/sounds/new-lead.mp3');
    newLeadAudio.preload = 'auto';

    bookingAudio = new Audio('/sounds/booking.mp3');
    bookingAudio.preload = 'auto';
  } catch (err) {
    console.warn('Audio elements could not be pre-initialized:', err);
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn('Could not initialize AudioContext:', err);
  }
  return audioCtx;
}

// Auto-unlock audio elements and AudioContext on first user interaction anywhere on the window
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      if (newLeadAudio) newLeadAudio.load();
      if (bookingAudio) bookingAudio.load();

      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {
      // Ignored
    }

    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Plays the "New Lead" notification sound (from /sounds/new-lead.mp3)
 */
export function playNewLeadSound() {
  if (newLeadAudio) {
    try {
      newLeadAudio.currentTime = 0;
      const playPromise = newLeadAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('New lead MP3 playback issue, falling back to chime:', err);
          playSyntheticLeadChime();
        });
      }
      return;
    } catch (err) {
      console.warn('HTML5 Audio error, using synthetic fallback:', err);
    }
  }
  playSyntheticLeadChime();
}

/**
 * Plays the "Booking Confirmed" notification sound (from /sounds/booking.mp3)
 */
export function playBookingSound() {
  if (bookingAudio) {
    try {
      bookingAudio.currentTime = 0;
      const playPromise = bookingAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Booking MP3 playback issue, falling back to chime:', err);
          playSyntheticBookingChime();
        });
      }
      return;
    } catch (err) {
      console.warn('HTML5 Audio error, using synthetic fallback:', err);
    }
  }
  playSyntheticBookingChime();
}

/**
 * Synthetic Fallback for New Lead: D5 (587.33 Hz) -> A5 (880.00 Hz)
 */
function playSyntheticLeadChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const play = () => {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.12);
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.4, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch (err) {
    console.warn('Synthetic lead chime error:', err);
  }
}

/**
 * Synthetic Fallback for Booking: Celebratory major chord sequence C5 -> E5 -> G5 -> C6
 */
function playSyntheticBookingChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const play = () => {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const startTime = now + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch (err) {
    console.warn('Synthetic booking chime error:', err);
  }
}
