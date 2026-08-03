import { LoadingSpinner } from './LoadingSpinner';

interface OptimizeButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function OptimizeButton({ onClick, isLoading, disabled = false }: OptimizeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          Optimizando…
        </>
      ) : (
        <>✨ Optimizar con IA</>
      )}
    </button>
  );
}
