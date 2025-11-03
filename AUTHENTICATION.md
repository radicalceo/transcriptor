# Guide d'Authentification

Ce guide explique comment fonctionne le système d'authentification de l'application Meeting Copilot.

## Vue d'ensemble

L'application utilise **NextAuth.js v4** (version stable) pour gérer l'authentification avec deux méthodes :
- **Google OAuth** : Connexion via un compte Google
- **Credentials** : Connexion classique avec email/mot de passe

## Configuration

### Variables d'environnement requises

Ajoutez ces variables dans votre fichier `.env` :

```bash
# NextAuth Configuration (REQUIS)
NEXTAUTH_SECRET="your-secret-here"  # Générer avec: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"  # URL de votre application

# Google OAuth (OPTIONNEL - seulement si vous voulez Google login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Configuration Google OAuth (optionnel)

Si vous souhaitez activer la connexion Google :

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Créez un nouveau projet ou sélectionnez-en un existant
3. Créez des identifiants OAuth 2.0
4. Ajoutez les URIs de redirection autorisées :
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://votre-domaine.com/api/auth/callback/google`
5. Copiez le Client ID et Client Secret dans votre `.env`

## Architecture

### Modèles de données (Prisma)

```prisma
model User {
  id            String    @id @default(uuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // Null pour les utilisateurs OAuth

  accounts      Account[]
  sessions      Session[]
  meetings      Meeting[]
}

model Meeting {
  // ... autres champs
  userId        String
  user          User     @relation(fields: [userId], references: [id])
}
```

### Routes

#### Pages d'authentification
- `/auth/signin` - Page de connexion
- `/auth/signup` - Page d'inscription

#### API Routes
- `/api/auth/[...nextauth]` - Routes NextAuth (gérées automatiquement)
- `/api/auth/register` - Inscription avec email/mot de passe

### Protection des routes

Un middleware protège automatiquement toutes les routes sauf :
- `/auth/*` - Pages d'authentification
- `/api/auth/*` - API d'authentification
- Fichiers statiques

```typescript
// middleware.ts
export const config = {
  matcher: [
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
```

### Utilisation dans les API Routes

Pour protéger une API route et récupérer l'utilisateur :

```typescript
import { requireAuth } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireAuth()

    // user.id, user.email, user.name sont disponibles
    const meetings = await prisma.meeting.findMany({
      where: { userId: user.id }
    })

    return NextResponse.json({ meetings })
  } catch (error) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    )
  }
}
```

### Utilisation côté client

```typescript
import { useSession, signIn, signOut } from "next-auth/react"

function Component() {
  const { data: session, status } = useSession()

  if (status === "loading") return <div>Chargement...</div>
  if (status === "unauthenticated") return <div>Non connecté</div>

  return (
    <div>
      <p>Connecté en tant que {session.user.email}</p>
      <button onClick={() => signOut()}>Se déconnecter</button>
    </div>
  )
}
```

## Sécurité

### Mots de passe
- Hachés avec **bcrypt** (10 rounds)
- Minimum 8 caractères requis
- Stockés uniquement pour les comptes avec credentials

### Sessions
- Utilise JWT pour les sessions
- Le secret JWT (`NEXTAUTH_SECRET`) doit être gardé confidentiel
- Les sessions expirent selon la configuration NextAuth

### Isolation des données
- Chaque utilisateur ne peut accéder qu'à ses propres meetings
- Vérification de propriété dans chaque API route
- Cascade delete : supprimer un user supprime ses meetings

## Migration des données existantes

Lors de la migration, un utilisateur par défaut a été créé :
- ID: `00000000-0000-0000-0000-000000000000`
- Email: `default@transcriptor.local`
- Tous les meetings existants ont été assignés à cet utilisateur

## Déploiement sur Vercel

1. Ajoutez les variables d'environnement dans les paramètres Vercel :
   ```
   NEXTAUTH_SECRET=<générez-un-nouveau-secret>
   NEXTAUTH_URL=<votre-url-production>
   GOOGLE_CLIENT_ID=<votre-client-id>
   GOOGLE_CLIENT_SECRET=<votre-client-secret>
   ```

2. Mettez à jour les URIs de redirection Google OAuth avec votre domaine de production

3. Vérifiez que `DATABASE_URL` est correctement configuré pour Vercel Postgres

## Tests

Pour tester l'authentification localement :

1. Démarrez le serveur : `npm run dev`
2. Accédez à `http://localhost:3000`
3. Vous serez redirigé vers `/auth/signin`
4. Créez un compte ou connectez-vous avec Google

### Créer un compte de test

```bash
# Via l'interface
1. Allez sur /auth/signup
2. Remplissez le formulaire
3. Cliquez sur "Créer mon compte"

# Ou via l'API directement
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Dépannage

### Erreur "Invalid secret"
- Vérifiez que `NEXTAUTH_SECRET` est défini dans `.env`
- Générez un nouveau secret : `openssl rand -base64 32`

### Erreur "Callback URL mismatch" (Google)
- Vérifiez que l'URL de callback est correctement configurée dans Google Cloud Console
- Format: `http://localhost:3000/api/auth/callback/google`

### Erreur "Prisma Client"
- Exécutez `npx prisma generate` pour régénérer le client Prisma
- Vérifiez que la migration a bien été appliquée : `npx prisma migrate status`

### Session non persistante
- Vérifiez que `SessionProvider` est bien dans le layout racine
- Vérifiez les cookies dans les outils de développement du navigateur

## Ressources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Prisma Adapter](https://authjs.dev/reference/adapter/prisma)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
