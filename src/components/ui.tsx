import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet';
};

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'rounded-lg bg-accent-400 px-5 py-2.5 font-medium text-space-950 transition-colors hover:bg-accent-300',
  ghost:
    'rounded-lg border border-space-700 px-5 py-2.5 text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100',
  quiet: 'px-2 py-1 text-sm text-ink-500 transition-colors hover:text-ink-300',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${VARIANTS[variant]} ${className}`} {...props} />;
}

export function Panel({ children, className = '', ...props }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <div className={`rounded-2xl border border-space-700 bg-space-950/85 p-6 shadow-xl ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-xs uppercase tracking-[0.2em] text-ink-500 ${className}`}>{children}</div>;
}
