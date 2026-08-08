/**
 * Usuario "actual". Antes de existir autenticación era una constante ('Ana');
 * ahora se actualiza en vivo desde la sesión (ver `setMe`), así que los
 * componentes que leen `ME` siempre ven quién está logueado.
 */
let currentMe = ''

export let ME = ''

export function setMe(name: string | null): void {
  ME = name ?? ''
  currentMe = name ?? ''
}

export function currentName(): string {
  return currentMe
}
