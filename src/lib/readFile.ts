/** Lee un archivo de imagen como data URL (base64) para almacenarlo. */

export function readFileAsDataURL(file: File, maxBytes = 1_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`La foto es muy grande (máx ${Math.round(maxBytes / 1_000_000)} MB)`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer la foto'))
    reader.readAsDataURL(file)
  })
}
