import LedgerhoundApp from '@/components/LedgerhoundApp';

export default function App() {
  return (
    <>
      {/* Tailwind wiring test: should render a red bar */}
      <div className="bg-red-500 text-white text-sm p-2 text-center">
        TAILWIND TEST — if this is red, Tailwind is active
      </div>

      <LedgerhoundApp />
    </>
  );
}
