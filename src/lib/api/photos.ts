import { request } from './transport'

/** Desktop: lee una foto guardada en disco y devuelve su data URL.
 * En web las fotos se sirven por HTTP (`/api/photos/{file}`), no por aquí. */
export function readPhoto(name: string): Promise<string> {
  return request<string>('read_photo', { name })
}
