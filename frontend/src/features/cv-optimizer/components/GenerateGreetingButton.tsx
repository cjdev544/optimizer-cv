import { LoadingSpinner } from './LoadingSpinner';

interface GenerateGreetingButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function GenerateGreetingButton({
  onClick,
  isLoading,
  disabled = false,
}: GenerateGreetingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <LoadingSpinner variant="dark" />
          Generando saludo…
        </>
      ) : (
        <>✉️ Generar Saludo</>
      )}
    </button>
  );
}
