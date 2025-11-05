# Guide de débogage - Authentification Vercel

## Problème
L'authentification ne fonctionne pas sur Vercel : vous êtes redirigé vers `/auth/signin` même après connexion.

## Checklist de résolution

### 1. Variables d'environnement Vercel (CRITIQUE)

Allez dans **Project Settings > Environment Variables** sur Vercel et vérifiez:

#### ✅ Variables obligatoires

```bash
# URL de production - DOIT correspondre à votre URL Vercel
NEXTAUTH_URL=https://your-app.vercel.app

# Secret NextAuth - Générez-en un nouveau
NEXTAUTH_SECRET=your-secret-here

# Base de données de production (Vercel Postgres ou autre)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Clés API (copiez depuis votre .env.local)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

#### ✅ Variables optionnelles (si Google OAuth)

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

⚠️ **Important**: Si vous utilisez Google OAuth, vous devez aussi ajouter votre URL Vercel dans la Google Cloud Console:
- Allez sur https://console.cloud.google.com/
- APIs & Services > Credentials
- Modifiez votre OAuth 2.0 Client ID
- Ajoutez dans "Authorized redirect URIs": `https://your-app.vercel.app/api/auth/callback/google`

### 2. Redéployer après modification

⚠️ **Les variables d'environnement ne sont appliquées qu'au prochain déploiement**

Après avoir ajouté/modifié les variables :
1. Allez dans l'onglet **Deployments**
2. Cliquez sur les 3 points du dernier déploiement
3. Cliquez sur **Redeploy**

Ou via CLI:
```bash
vercel --prod
```

### 3. Vérifier les logs Vercel

Allez dans **Deployments > [Latest] > Runtime Logs** et cherchez:
- Erreurs de connexion à la base de données
- Erreurs `NEXTAUTH_SECRET` ou `NEXTAUTH_URL`
- Erreurs Prisma

### 4. Base de données

Si vous utilisez Vercel Postgres:
```bash
# Vérifier que les migrations sont appliquées
npx prisma migrate deploy
```

Sinon, assurez-vous que:
- Votre base de données de production est accessible depuis Vercel
- Les tables NextAuth existent (`User`, `Session`, `Account`, etc.)

### 5. Tester localement en mode production

```bash
# Construire l'app en mode production
npm run build
npm start

# Tester avec NEXTAUTH_URL pointant vers localhost
NEXTAUTH_URL=http://localhost:3000 npm start
```

## Commandes utiles

### Générer un nouveau NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```

### Vérifier la connexion à la base de données
```bash
npx prisma db pull
```

### Voir les logs en temps réel
```bash
vercel logs --follow
```

### Vérifier votre configuration locale
```bash
npm run check:auth
```

## Erreurs courantes

### "NEXTAUTH_URL not configured"
→ Ajoutez `NEXTAUTH_URL` dans les variables d'environnement Vercel

### "Invalid session" ou cookies non définis
→ Vérifiez que votre domaine supporte HTTPS (Vercel le fait automatiquement)

### "Database connection failed"
→ Vérifiez `DATABASE_URL` et que votre base de données accepte les connexions externes

### Redirection infinie vers /auth/signin
→ Problème de cookies/session, vérifiez `NEXTAUTH_URL` et `NEXTAUTH_SECRET`

## Changements apportés dans le code

✅ **lib/auth.ts:60-69** - Configuration des cookies sécurisés en production
✅ **lib/auth.ts:55** - Durée de session étendue à 30 jours
✅ **lib/auth.ts:105** - Mode debug activé en développement
✅ **app/auth/signin/page.tsx:20-34** - Messages d'erreur en français

## Support

Si le problème persiste :
1. Consultez les logs Vercel (Runtime Logs)
2. Vérifiez les Network logs du navigateur (onglet Network > Cookies)
3. Utilisez `npm run check:auth` pour vérifier votre config locale
4. Activez le mode debug en ajoutant `debug: true` dans authOptions (déjà fait en dev)
