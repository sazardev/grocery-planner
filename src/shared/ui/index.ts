/* ============================================================
   Grocery Planner — Design System
   Barrel público. Importa desde aquí:
     import { Button, Card, NavBar } from '@/shared/ui'
   ============================================================ */

/* --- Primitivas --- */
export { default as Text } from './primitives/Text.tsx'
export type { TextVariant, TextTone, TextWeight } from './primitives/Text.tsx'
export { default as Button } from './primitives/Button.tsx'
export type { ButtonVariant, ButtonSize } from './primitives/Button.tsx'
export { default as IconButton } from './primitives/IconButton.tsx'
export type { IconButtonVariant } from './primitives/IconButton.tsx'
export { default as Chip } from './primitives/Chip.tsx'
export type { ChipTone } from './primitives/Chip.tsx'
export { default as Badge } from './primitives/Badge.tsx'
export type { BadgeTone } from './primitives/Badge.tsx'
export { default as Avatar } from './primitives/Avatar.tsx'
export type { AvatarSize } from './primitives/Avatar.tsx'
export { default as Checkbox } from './primitives/Checkbox.tsx'
export { default as ProgressBar } from './primitives/ProgressBar.tsx'
export { default as Skeleton } from './primitives/Skeleton.tsx'
export { default as Spinner } from './primitives/Spinner.tsx'

/* --- Layout --- */
export { default as Stack } from './layout/Stack.tsx'
export { default as Inline } from './layout/Inline.tsx'
export { default as Grid } from './layout/Grid.tsx'
export { default as Container } from './layout/Container.tsx'
export { default as Card } from './layout/Card.tsx'
export type { Spacing } from './layout/spacing.ts'

/* --- Formularios --- */
export { default as Field } from './form/Field.tsx'
export { default as DatePicker } from './form/DatePicker.tsx'
export type { DatePickerProps } from './form/DatePicker.tsx'
export { default as TimePicker } from './form/TimePicker.tsx'
export type { TimePickerProps } from './form/TimePicker.tsx'
export { default as Input } from './form/Input.tsx'
export { default as Textarea } from './form/Textarea.tsx'
export { default as Select } from './form/Select.tsx'
export { default as Switch } from './form/Switch.tsx'

/* --- Feedback --- */
export { default as Alert } from './feedback/Alert.tsx'
export { default as EmptyState } from './feedback/EmptyState.tsx'
export { default as Toast } from './feedback/Toast.tsx'

/* --- Navegación --- */
export { default as NavBar } from './navigation/NavBar.tsx'
export type { NavItem, NavBarProps } from './navigation/NavBar.tsx'
export { default as TabBar } from './navigation/TabBar.tsx'
export { default as FAB } from './navigation/FAB.tsx'
export { default as ShareButton } from './navigation/ShareButton.tsx'

/* --- Data display --- */
export { default as List } from './data-display/List.tsx'
export { default as ListItem } from './data-display/ListItem.tsx'
export { default as ItemRow } from './data-display/ItemRow.tsx'
