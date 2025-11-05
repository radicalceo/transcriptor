# Exemple de .env.local

## Development
```bash
# OpenAI API Key (Required)
OPENAI_API_KEY=sk-...

# Anthropic API Key (Required)
ANTHROPIC_API_KEY=sk-ant-...

# Database (Required)
DATABASE_URL=postgresql://user:password@localhost:5432/transcriptor

# NextAuth (Required)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Vercel Blob Storage (Optional for local dev)
# Only required if testing audio upload locally
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxx
```

## Production (Vercel)
Sur Vercel, configurer les variables d'environnement suivantes :

1. **OPENAI_API_KEY** : API key OpenAI
2. **ANTHROPIC_API_KEY** : API key Anthropic
3. **DATABASE_URL** : Auto-configuré par Vercel Postgres
4. **NEXTAUTH_SECRET** : Généré avec `openssl rand -base64 32`
5. **NEXTAUTH_URL** : URL de production (ex: https://transcriptor.vercel.app)
6. **BLOB_READ_WRITE_TOKEN** : Auto-configuré par Vercel Blob Storage

### Setup Vercel Blob Storage
1. Dans le dashboard Vercel, aller dans "Storage"
2. Créer un nouveau "Blob Store"
3. Le connecter au projet
4. La variable `BLOB_READ_WRITE_TOKEN` sera automatiquement configurée