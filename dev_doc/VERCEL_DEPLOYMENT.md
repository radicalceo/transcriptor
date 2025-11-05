# Guide de déploiement sur Vercel

## Prérequis

- Un compte Vercel
- Un projet Next.js connecté à votre repository Git

## Configuration de la base de données

### 1. Créer une base de données PostgreSQL

1. Dans votre projet Vercel, allez dans l'onglet **Storage**
2. Cliquez sur **Create Database**
3. Sélectionnez **Postgres**
4. Choisissez une région (idéalement proche de vos utilisateurs)
5. Donnez un nom à votre base (ex: `meeting-copilot-db`)
6. Cliquez sur **Create**

### 2. Connecter la base à votre projet

1. Une fois la base créée, cliquez sur **Connect**
2. Sélectionnez votre projet dans la liste
3. Vercel ajoutera automatiquement les variables d'environnement nécessaires :
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - etc.

### 3. Configurer DATABASE_URL

Dans les **Environment Variables** de votre projet :

1. Allez dans **Settings** → **Environment Variables**
2. Ajoutez ou vérifiez que `DATABASE_URL` existe et pointe vers `POSTGRES_PRISMA_URL`
3. Si `DATABASE_URL` n'existe pas, ajoutez-la avec la valeur : `$POSTGRES_PRISMA_URL`

## Variables d'environnement requises

Assurez-vous d'avoir configuré toutes ces variables dans Vercel :

### Base de données
- `DATABASE_URL` : URL de connexion Prisma (fournie automatiquement par Vercel Postgres)

### NextAuth
- `NEXTAUTH_URL` : URL de votre application (ex: `https://your-app.vercel.app`)
- `NEXTAUTH_SECRET` : Secret pour signer les tokens (générez-en un avec `openssl rand -base64 32`)

### OpenAI (pour la transcription en temps réel)
- `OPENAI_API_KEY` : Votre clé API OpenAI

### Anthropic (pour les résumés et suggestions)
- `ANTHROPIC_API_KEY` : Votre clé API Anthropic

### Email (Resend - optionnel)
- `RESEND_API_KEY` : Pour l'envoi d'emails de vérification
- `EMAIL_FROM` : Adresse email d'envoi (ex: `noreply@your-domain.com`)

### OAuth Providers (optionnel)
Si vous utilisez Google OAuth :
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Migration de la base de données

Le script `vercel-build` dans `package.json` exécutera automatiquement `prisma migrate deploy` lors du build sur Vercel.

```json
"vercel-build": "prisma migrate deploy && next build"
```

Vercel détecte automatiquement ce script et l'utilisera à la place du script `build` standard.

## Déploiement

### Déploiement automatique

1. Poussez vos changements sur votre branche principale (main/master)
2. Vercel déclenchera automatiquement un nouveau déploiement
3. Les migrations seront exécutées avant le build
4. Le déploiement sera actif une fois terminé

### Déploiement manuel

Si vous devez redéployer sans pusher de nouveau code :

1. Allez dans l'onglet **Deployments**
2. Cliquez sur les trois points ⋮ du dernier déploiement
3. Sélectionnez **Redeploy**

## Vérification du déploiement

### 1. Vérifier les logs de build

1. Allez dans **Deployments** → Sélectionnez votre déploiement
2. Cliquez sur **Building**
3. Vérifiez que les migrations Prisma se sont bien exécutées :
   ```
   Running "vercel-build"
   Prisma Migrate applied successfully
   ```

### 2. Tester l'authentification

1. Visitez votre application
2. Essayez de vous connecter
3. Si vous voyez l'erreur "The table `public.Account` does not exist", les migrations n'ont pas été exécutées

## Dépannage

### Erreur : "The table `public.Account` does not exist"

**Causes possibles :**
1. Les migrations n'ont pas été exécutées
2. `DATABASE_URL` pointe vers une base vide
3. Le script `vercel-build` n'a pas été détecté

**Solutions :**

#### Option 1 : Redéployer
1. Commitez le changement du `package.json` (script `vercel-build`)
2. Poussez sur votre branche
3. Attendez le nouveau déploiement

#### Option 2 : Exécuter les migrations manuellement
Depuis votre machine locale :

```bash
# 1. Récupérez l'URL de la base Vercel
# (Dans Vercel Dashboard → Storage → votre base → .env.local)

# 2. Copiez POSTGRES_PRISMA_URL dans votre terminal
export DATABASE_URL="postgres://..."

# 3. Exécutez les migrations
npx prisma migrate deploy

# 4. Vérifiez que les tables existent
npx prisma studio
```

#### Option 3 : Push du schéma (pour le développement uniquement)
```bash
export DATABASE_URL="postgres://..."
npx prisma db push
```

⚠️ **Attention** : `db push` ne gère pas l'historique des migrations. Utilisez `migrate deploy` en production.

### Erreur de connexion à la base

**Symptôme :** `Can't reach database server`

**Solution :**
1. Vérifiez que `DATABASE_URL` utilise `POSTGRES_PRISMA_URL` (avec connection pooling)
2. Ne pas utiliser `POSTGRES_URL_NON_POOLING` dans Vercel (serverless)

### Variables d'environnement manquantes

Si vous voyez des erreurs sur des variables manquantes :

1. Allez dans **Settings** → **Environment Variables**
2. Ajoutez les variables manquantes
3. Redéployez le projet

## Monitoring

### Logs d'exécution

Pour voir les logs en temps réel :
1. **Deployments** → Sélectionnez le déploiement actif
2. Cliquez sur **Functions**
3. Sélectionnez une fonction pour voir ses logs

### Base de données

Pour monitorer votre base Vercel Postgres :
1. **Storage** → Sélectionnez votre base
2. Onglet **Insights** : métriques de performance
3. Onglet **Queries** : requêtes lentes

## Meilleures pratiques

1. **Toujours tester localement** avant de déployer
2. **Utilisez des branches de preview** pour tester les changements
3. **Vérifiez les logs** après chaque déploiement
4. **Gardez vos secrets sécurisés** : ne committez jamais `.env.local`
5. **Utilisez `migrate deploy`** en production, pas `db push`
6. **Créez des migrations** pour chaque changement de schéma :
   ```bash
   npx prisma migrate dev --name descriptive_name
   ```

## Scripts utiles

```bash
# Générer le client Prisma
npm run postinstall

# Créer une nouvelle migration
npx prisma migrate dev --name add_new_field

# Appliquer les migrations en production
npx prisma migrate deploy

# Visualiser la base de données
npx prisma studio

# Réinitialiser la base (développement uniquement)
npx prisma migrate reset
```
