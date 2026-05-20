import React from 'react';

// 'accent' = gold CTA used sparingly (book appointment, approve AI). 'primary'
// is the everyday obsidian button. 'ai' is reserved for AI-suggested actions.
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'ai' | 'icon';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...rest
}) => {
  if (variant === 'icon') {
    return (
      <button
        type={type}
        disabled={disabled || loading}
        className={`btn-icon ${fullWidth ? 'w-full' : ''} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${sizeClass[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {leadingIcon}
          {children}
          {trailingIcon}
        </>
      )}
    </button>
  );
};

export default Button;
