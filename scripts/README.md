# Scripts de maintenance

## Régénération de résumés

### Script simplifié (recommandé)

Utilisez le script bash à la racine du projet:

```bash
./regenerate.sh <meetingId>
```

**Exemples:**
```bash
# Régénérer un seul meeting
./regenerate.sh 9e673d01-92b7-41db-951c-ce1bb5887dd6

# Régénérer plusieurs meetings (en séquence)
./regenerate.sh 9e673d01-92b7-41db-951c-ce1bb5887dd6
./regenerate.sh b45d1cf1-bfd3-439b-975e-7e90579542db
./regenerate.sh 2ce3aaf2-37bb-49fd-a72f-2251dcdd1503
```

### Script TypeScript (avancé)

Si vous préférez utiliser le script TypeScript directement:

```bash
DATABASE_URL="<votre-database-url>" tsx scripts/regenerate-summary.ts <meetingId>
```

**Exemple:**
```bash
DATABASE_URL="postgresql://user:pass@host/db" tsx scripts/regenerate-summary.ts 9e673d01-92b7-41db-951c-ce1bb5887dd6
```

## Comment ça marche?

Le script:
1. 🔍 Récupère le meeting depuis la base de données
2. 📝 Vérifie qu'il a une transcription
3. 🤖 Génère un nouveau résumé avec Claude (Haiku ou Sonnet 4.5 selon la taille)
4. 💾 Sauvegarde le résumé en base de données
5. ✅ Met à jour le status à 'completed'

## Détection automatique du modèle

- **Transcriptions courtes** (< 15k caractères): Claude 3 Haiku (rapide, économique)
- **Transcriptions longues** (≥ 15k caractères): Claude Sonnet 4.5 (plus de capacité, meilleure qualité)

## Gestion des erreurs

Si une erreur survient:
- Le status du meeting est mis à `'error'`
- Le message d'erreur est stocké dans le champ `notes`
- Vous pouvez réessayer en relançant le script

## Limitation Vercel Hobby

⚠️ **Important**: Ces scripts fonctionnent en local car ils nécessitent plus de 10 secondes d'exécution.

Sur Vercel Hobby (limite de 10s), la régénération automatique ne fonctionne pas. C'est pourquoi vous devez utiliser ces scripts en local pour régénérer les résumés manuellement.

## Prérequis

- Node.js et tsx installés
- Variables d'environnement configurées dans `.env`:
  - `DATABASE_URL`: URL de la base de données
  - `ANTHROPIC_API_KEY`: Clé API Claude
  - `OPENAI_API_KEY`: Clé API OpenAI (pour Whisper si besoin)
