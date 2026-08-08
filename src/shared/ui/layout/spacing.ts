export type Spacing = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16'

export const spaceVar: Record<Spacing, string> = {
  '0': 'var(--gp-space-0)',
  '1': 'var(--gp-space-1)',
  '2': 'var(--gp-space-2)',
  '3': 'var(--gp-space-3)',
  '4': 'var(--gp-space-4)',
  '5': 'var(--gp-space-5)',
  '6': 'var(--gp-space-6)',
  '8': 'var(--gp-space-8)',
  '10': 'var(--gp-space-10)',
  '12': 'var(--gp-space-12)',
  '16': 'var(--gp-space-16)',
}
