import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly children: ReactNode;
  readonly tone?: 'primary' | 'secondary' | 'danger';
};

export function Button({
  children,
  className = '',
  tone = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button className={`lc-button lc-button--${tone} ${className}`.trim()} type={type} {...props}>
      {children}
    </button>
  );
}
