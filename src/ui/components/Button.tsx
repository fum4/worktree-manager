import { button, text } from '../theme';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  size = 'sm',
  disabled,
  loading,
  className = '',
}: ButtonProps) {
  const sizeClass = size === 'sm'
    ? 'px-3 py-1.5 text-xs'
    : 'px-4 py-2 text-sm';

  const baseClass = `${sizeClass} font-medium rounded-lg transition-colors flex items-center gap-2`;

  const variantClasses = {
    primary: `${button.primary} disabled:bg-[#2dd4bf]/5 disabled:text-[#2dd4bf]/40`,
    secondary: `${text.muted} hover:${text.secondary} hover:bg-white/[0.04] disabled:opacity-50`,
    danger: 'text-red-400 hover:bg-red-400/10 disabled:opacity-50',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
    >
      {loading && (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
