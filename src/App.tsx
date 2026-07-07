import { SceneCanvas } from './canvas/SceneCanvas';

export function App() {
  return (
    <div className="relative h-full">
      <SceneCanvas />
      <div className="relative flex h-full flex-col items-center justify-end pb-16">
        <h1 className="text-sm tracking-[0.3em] text-ink-500">DRIFTLESS</h1>
      </div>
    </div>
  );
}
