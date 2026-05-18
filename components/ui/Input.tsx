import React, { forwardRef } from 'react';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  trailing?: React.ReactNode;
  className?: string;
}

interface InputProps
  extends FieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, trailing, className = '', inputClassName = '', ...rest }, ref) => (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-muted">{label}</label>
      )}
      <div className="relative">
        <input ref={ref} className={inputClassName} {...rest} />
        {trailing && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            {trailing}
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-hint">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}
    </div>
  ),
);
Input.displayName = 'Input';

interface SelectProps
  extends FieldProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  selectClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className = '', selectClassName = '', children, ...rest }, ref) => (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-muted">{label}</label>
      )}
      <select ref={ref} className={selectClassName} {...rest}>
        {children}
      </select>
      {hint && !error && (
        <p className="text-xs text-hint">{hint}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

interface TextareaProps
  extends FieldProps,
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  textareaClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className = '', textareaClassName = '', ...rest }, ref) => (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-muted">{label}</label>
      )}
      <textarea ref={ref} className={textareaClassName} {...rest} />
      {hint && !error && <p className="text-xs text-hint">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';

export default Input;
