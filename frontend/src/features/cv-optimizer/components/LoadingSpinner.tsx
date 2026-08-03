interface LoadingSpinnerProps {
  variant?: 'light' | 'dark';
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<LoadingSpinnerProps['variant']>, string> = {
  light: 'border-white/40 border-t-white',
  dark: 'border-indigo-200 border-t-indigo-600',
};

export function LoadingSpinner({ variant = 'light', className = '' }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
