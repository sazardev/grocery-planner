import { useMeta } from './useMeta.ts'

/** Fija el título del documento (deep linking / SEO). */
export function useDocumentTitle(title: string) {
  useMeta({ title })
}
