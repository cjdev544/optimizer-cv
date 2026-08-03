import { CvOptimizerPanel } from '@/features/cv-optimizer/components/CvOptimizerPanel';

export function App() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-gray-50 py-10">
      <div className="w-full max-w-md rounded-lg bg-white shadow">
        <CvOptimizerPanel />
      </div>
    </main>
  );
}
