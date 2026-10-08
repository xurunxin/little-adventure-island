import {taskSeeds, type State, type Task, type Claim} from "./domain";
let playing: HTMLAudioElement | undefined;
let context: AudioContext | undefined;
export function stopAudio() {
  playing?.pause();
  playing = undefined;
  if (context?.state === "running") void context.suspend();
}
export async function say(key: string, volume: number, recording?: string) {
  playing?.pause();
  if (volume === 0) return;
  playing = new Audio(recording || `/audio/${key}.mp3`);
  playing.volume = volume;
  try {
    await playing.play();
  } catch {
    /* The picture and visible instruction remain usable if device audio is unavailable. */
  }
}
export function speakTask(task: Task | Claim, state: State) {
  const id='taskId' in task ? task.taskId : task.id;
  void say(
    task.voice || (taskSeeds.some(t=>t.id===id)?id:'custom-task'),
    state.settings.volume,
    'taskId' in task ? (task.recordingId ? state.voiceAssets[task.recordingId] : undefined) : state.recordings[id],
  );
}
export async function sound(
  kind: "tap" | "success" | "reward",
  volume: number,
) {
  if (volume === 0) return;
  context ??= new AudioContext();
  await context.resume();
  const now = context.currentTime;
  const notes =
    kind === "tap"
      ? [620]
      : kind === "success"
        ? [523, 659, 784]
        : [523, 659, 784, 1047];
  notes.forEach((frequency, i) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(volume * 0.12, now + i * 0.1 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
    oscillator.connect(gain);
    gain.connect(context!.destination);
    oscillator.start(now + i * 0.1);
    oscillator.stop(now + i * 0.1 + 0.22);
  });
}
