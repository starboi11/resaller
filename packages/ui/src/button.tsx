import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean };
export function Button({ asChild = false, className = '', ...props }: Props) {
  const Component = asChild ? Slot : 'button';
  return <Component className={`rs-button ${className}`} {...props} />;
}
