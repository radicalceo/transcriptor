'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'

export default function UploadPage() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    setError('')

    // Validation côté client
    const validExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validExtensions.includes(extension)) {
      setError(`Format non supporté. Formats acceptés: ${validExtensions.join(', ')}`)
      return
    }

    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > 200) {
      setError(`Fichier trop volumineux (${sizeMB.toFixed(1)} MB). Maximum: 200 MB`)
      return
    }

    setSelectedFile(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError('')

    try {
      console.log('📤 Uploading to Blob Storage...')

      // Import du SDK client-side
      const { upload } = await import('@vercel/blob/client')

      // Upload direct vers Blob Storage avec le SDK
      const blob = await upload(selectedFile.name, selectedFile, {
        access: 'public',
        handleUploadUrl: '/api/upload-url',
      })

      console.log('✅ File uploaded to Blob:', blob.url)

      // Étape 2: Notifier le serveur pour commencer le traitement
      console.log('🎙️ Starting transcription...')
      const processResponse = await fetch('/api/process-uploaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
        }),
      })

      if (!processResponse.ok) {
        const errorText = await processResponse.text()
        throw new Error(`Processing failed: ${errorText}`)
      }

      const data = await processResponse.json()

      if (data.success) {
        // Rediriger vers la page de succès
        router.push('/upload/success')
      } else {
        setError(data.error || 'Processing failed')
        setIsUploading(false)
      }
    } catch (err: any) {
      console.error('Upload error:', err)

      // Fallback sur l'ancien système si Blob échoue
      if (err.message?.includes('Blob') || err.message?.includes('BLOB_READ_WRITE_TOKEN')) {
        console.log('⚠️ Blob upload failed, trying legacy upload (max 25MB)...')
        return await handleLegacyUpload()
      }

      setError(err.message || 'Upload failed')
      setIsUploading(false)
    }
  }

  // Upload legacy pour fichiers < 25MB si Blob n'est pas configuré
  const handleLegacyUpload = async () => {
    try {
      const formData = new FormData()
      formData.append('file', selectedFile!)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        try {
          const errorData = JSON.parse(errorText)
          setError(errorData.error || `Upload failed with status ${response.status}`)
        } catch {
          setError(`Upload failed: ${errorText.substring(0, 200)}`)
        }
        setIsUploading(false)
        return
      }

      const data = await response.json()

      if (data.success) {
        // Rediriger vers la page de succès
        router.push('/upload/success')
      } else {
        setError(data.error || 'Upload failed')
        setIsUploading(false)
      }
    } catch (err: any) {
      console.error('Legacy upload error:', err)
      setError(err.message || 'Upload failed')
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 mb-4"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Retour
            </button>

            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Uploader un enregistrement
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Chargez un fichier audio pour obtenir la transcription et l&apos;analyse
            </p>
          </div>

          {/* Upload Area */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {!selectedFile ? (
                <>
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>

                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Glissez-déposez votre fichier audio ici
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    ou
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Parcourir les fichiers
                  </button>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                    Formats supportés: MP3, MP4, WAV, M4A, WebM (max 200 MB)
                  </p>
                </>
              ) : (
                <>
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>

                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Changer
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <svg
                            className="animate-spin h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Traitement...
                        </>
                      ) : (
                        'Analyser'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            {isUploading && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-800 dark:text-blue-300 text-sm">
                  📤 Upload en cours... La transcription démarrera automatiquement.
                </p>
                <p className="text-blue-700 dark:text-blue-400 text-xs mt-2">
                  Vous serez redirigé vers la page du meeting une fois l&apos;upload terminé.
                </p>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
              Comment ça marche ?
            </h3>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex gap-2">
                <span className="font-medium">1.</span>
                <span>Uploadez votre fichier audio (meeting, conférence, etc.)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium">2.</span>
                <span>L&apos;IA transcrit l&apos;audio avec Whisper</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium">3.</span>
                <span>Claude analyse et extrait thèmes, décisions et actions</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium">4.</span>
                <span>Consultez et modifiez le résumé généré</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
