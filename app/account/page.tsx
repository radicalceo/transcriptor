"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Retour à l'accueil
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Mon compte</h1>
        </div>

        {/* Account Info Card */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Informations du compte
            </h2>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-md border border-gray-200">
                {session.user?.email || "Non renseigné"}
              </div>
            </div>

            {/* Name */}
            {session.user?.name && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-md border border-gray-200">
                  {session.user.name}
                </div>
              </div>
            )}

            {/* Provider info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Méthode de connexion
              </label>
              <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-md border border-gray-200">
                {session.user?.image ? "Google" : "Email / Mot de passe"}
              </div>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Actions</h2>
          </div>

          <div className="px-6 py-5 space-y-3">
            {/* Change Password - only for credentials users */}
            {!session.user?.image && (
              <div className="pb-3 border-b border-gray-200">
                <button
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2"
                  onClick={() => {
                    // TODO: Implement password change functionality
                    alert("Fonctionnalité de changement de mot de passe à venir");
                  }}
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
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  Changer le mot de passe
                </button>
              </div>
            )}

            {/* Sign Out */}
            <div>
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                {isLoading ? "Déconnexion..." : "Se déconnecter"}
              </button>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Note de sécurité</p>
              <p>
                Vos informations sont sécurisées et ne sont jamais partagées
                avec des tiers. En cas de problème avec votre compte, contactez
                le support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
