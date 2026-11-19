import type { ReactNode } from 'react'

interface FieldProps {
  id: string
  label: string
  error?: string
  children: ReactNode
}

export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-help`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function errorAttributes(id: string, error?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-help` : undefined,
  }
}
