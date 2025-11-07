'use client'

import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function UploadSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-700">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Upload réussi !
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Votre fichier est en cours de traitement.
          <br />
          <br />
          Vous recevrez un email quand la transcription sera prête.
          <br />
          <span className="text-sm text-gray-500 dark:text-gray-500">
            (Comptez 5-10 minutes selon la taille du fichier)
          </span>
        </p>

        <Link
          href="/"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
