import clsx from 'clsx';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-flag text-white hover:bg-flag-deep active:bg-flag-deep disabled:bg-line-strong disabled:text-white',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-ink-2 disabled:text-muted',
  ghost: 'text-ink-2 hover:bg-paper-2 disabled:text-muted',
  danger: 'bg-surface text-danger border border-danger/40 hover:bg-danger-tint',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-13 px-6 text-base gap-2 rounded-xl',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
