/**
 * Service pour gérer l'upload de fichiers audio
 * Utilise Vercel Blob Storage si disponible, sinon upload direct
 */

export function isBlobStorageAvailable(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

export function getUploadEndpoint(): string {
  // Si Blob Storage est disponible, l'utiliser (pas de limite de taille)
  if (typeof window !== 'undefined') {
    // Côté client, on ne peut pas accéder aux env variables serveur
    // On va essayer Blob d'abord, et fallback sur /api/upload en cas d'erreur
    return '/api/upload-blob'
  }

  return isBlobStorageAvailable() ? '/api/upload-blob' : '/api/upload'
}

export function getMaxFileSize(): number {
  // Si Blob Storage est disponible, limite de 200 MB
  // Sinon, limite de 25 MB pour éviter les erreurs Vercel
  return isBlobStorageAvailable() ? 200 : 25
}
