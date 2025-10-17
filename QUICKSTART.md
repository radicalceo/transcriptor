# Quick Start Guide

## Setup rapide (< 5 minutes)

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration des clés API

Créez un fichier `.env.local` à la racine :

```env
ANTHROPIC_API_KEY=sk-ant-votre-clé-ici
```

Pour obtenir votre clé API Anthropic :
- Allez sur https://console.anthropic.com/
- Créez un compte ou connectez-vous
- Naviguez vers "API Keys"
- Créez une nouvelle clé API

### 3. Lancement

```bash
npm run dev
```

Ouvrez http://localhost:3000 dans Chrome ou Edge.

### 4. Premier test

1. Cliquez sur "Démarrer un meeting"
2. Autorisez l'accès au microphone
3. Parlez pendant quelques secondes
4. Observez la transcription et les suggestions apparaître
5. Cliquez sur "Terminer le meeting" pour voir le résumé

## Troubleshooting

### Erreur "API Key not found"
- Vérifiez que `.env.local` existe à la racine
- Vérifiez que la clé commence par `sk-ant-`
- Redémarrez le serveur après modification du `.env.local`

### Erreur "Microphone not accessible"
- Utilisez Chrome ou Edge (Safari non supporté)
- Accordez les permissions microphone au navigateur
- En localhost, pas besoin de HTTPS
- En production, HTTPS est requis

### Les suggestions ne s'affichent pas
- Parlez pendant au moins 30 secondes
- Les suggestions apparaissent après ~10 secondes de parole
- Vérifiez la console pour les erreurs API

### Erreur de build
```bash
rm -rf .next node_modules
npm install
npm run build
```

## Architecture simplifiée

```
User parle → Web Speech API → Transcript
                                    ↓
                          Stockage en mémoire
                                    ↓
                    Polling /api/suggestions (5s)
                                    ↓
                              Claude analyse
                                    ↓
                          Suggestions affichées
```

## Limitations du MVP

- Données en mémoire uniquement (redémarrage = perte)
- Chrome/Edge uniquement
- Français par défaut
- Pas d'upload de fichier
- Pas d'authentification
- Pas d'historique persistant

## Prochaines étapes

Une fois le MVP validé, consultez :
- `README.md` pour la documentation complète
- `doc/` pour les spécifications détaillées
- `.env.example` pour les variables optionnelles

## Support

En cas de problème :
1. Vérifiez la console du navigateur (F12)
2. Vérifiez les logs du serveur
3. Consultez les issues GitHub du projet

Bon test ! 🚀
