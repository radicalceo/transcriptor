# 🚀 Fix rapide - Authentification Vercel

## Le problème
Vous êtes redirigé vers `/auth/signin` à chaque fois → **C'est un problème de configuration des variables d'environnement**

## ✅ Solution rapide (5 minutes)

### 1. Sur Vercel.com

Allez dans votre projet → **Settings** → **Environment Variables**

Ajoutez ces variables pour **Production**, **Preview** ET **Development**:

```bash
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret-here  # Générez avec: openssl rand -base64 32
DATABASE_URL=postgresql://user:password@host:5432/dbname
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Si vous utilisez Google Sign-In**, ajoutez aussi:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

⚠️ **IMPORTANT**: Remplacez toutes les valeurs par vos vraies clés (voir `.env.local` pour référence)

### 2. Configuration Google OAuth (si applicable)

Sur https://console.cloud.google.com/:
1. APIs & Services > Credentials
2. Cliquez sur votre OAuth 2.0 Client ID
3. Dans "Authorized redirect URIs", ajoutez:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```
4. Sauvegardez

### 3. Redéployer

Sur Vercel:
- Onglet **Deployments**
- Derniers déploiement > 3 points > **Redeploy**

Ou en CLI:
```bash
git add .
git commit -m "Fix: improve NextAuth config for production"
git push
```

## 🧪 Tester localement

```bash
# Vérifier votre configuration locale
npm run check:auth

# Tester en mode production local
npm run build
npm start
```

## 📝 Ce qui a été corrigé dans le code

✅ Configuration des cookies sécurisés en production (lib/auth.ts:60-69)
✅ Durée de session de 30 jours (lib/auth.ts:55)
✅ Mode debug activé en développement (lib/auth.ts:105)
✅ Affichage des erreurs NextAuth avec messages en français (app/auth/signin/page.tsx)

## 🆘 Si ça ne fonctionne toujours pas

Consultez **VERCEL_AUTH_DEBUG.md** pour un guide complet de débogage.

Ou vérifiez les logs Vercel:
```bash
vercel logs --follow
```

## 🔑 Générer un nouveau secret

```bash
openssl rand -base64 32
```
