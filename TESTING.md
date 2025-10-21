# Guide des Tests E2E - Meeting Copilot

Ce document fournit un guide rapide pour exécuter les tests end-to-end après chaque développement majeur.

## ⚠️ Tests corrigés !

Les tests ont été mis à jour pour correspondre à la structure réelle de votre application. Tous les tests devraient maintenant passer ✅

## 🚀 Démarrage rapide

### Installation initiale (une seule fois)

Si ce n'est pas déjà fait, installez les navigateurs Playwright :

```bash
npx playwright install
```

### Lancer les tests

```bash
# Lancer tous les tests
npm run test:e2e
```

C'est tout ! Les tests vont :
1. Démarrer automatiquement le serveur de développement
2. Exécuter tous les tests sur les pages principales
3. Générer un rapport HTML avec les résultats

## 📊 Voir les résultats

Après l'exécution, ouvrez le rapport :

```bash
npm run test:e2e:report
```

## 🎯 Cas d'usage recommandés

### Après avoir ajouté une nouvelle fonctionnalité

```bash
# Tester tout pour s'assurer que rien n'est cassé
npm run test:e2e

# Si tout passe ✅, vous pouvez commit/push
```

### Pendant le développement

Utilisez le mode UI pour voir les tests en direct :

```bash
npm run test:e2e:ui
```

Avantages :
- Interface graphique intuitive
- Voir les tests s'exécuter en temps réel
- Rejouer facilement les tests qui échouent
- Inspecter les éléments de la page

### Si un test échoue

```bash
# Déboguer le test qui échoue
npm run test:e2e:debug

# Ou lancer un seul fichier de test
npx playwright test e2e/homepage.spec.ts --headed
```

## 📝 Tests disponibles

| Fichier | Fonctionnalités testées |
|---------|------------------------|
| `homepage.spec.ts` | Page d'accueil, navigation |
| `upload.spec.ts` | Upload de fichiers audio |
| `meeting.spec.ts` | Enregistrement, transcription en direct |
| `summary.spec.ts` | Affichage du résumé final |
| `history.spec.ts` | Liste des meetings passés |

## ✅ Checklist avant de déployer

- [ ] Lancer `npm run test:e2e`
- [ ] Tous les tests passent (vert ✅)
- [ ] Vérifier le rapport avec `npm run test:e2e:report`
- [ ] Si des tests échouent, les corriger avant de continuer

## 🔧 Dépannage rapide

### "Cannot find module"
```bash
npm install --legacy-peer-deps
```

### "Port 3000 already in use"
```bash
# Mac/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Les tests sont très lents
Les tests mockent les APIs externes (OpenAI, Claude) donc ils devraient être rapides. Si ce n'est pas le cas :
- Vérifiez votre connexion internet
- Fermez les autres applications gourmandes en ressources

## 📚 Documentation complète

Pour plus de détails, consultez le [README des tests E2E](./e2e/README.md).

## 🤝 Contribution

Si vous ajoutez une nouvelle fonctionnalité, pensez à :
1. Ajouter des tests pour cette fonctionnalité
2. Vérifier que tous les tests existants passent
3. Mettre à jour cette documentation si nécessaire

---

**Temps d'exécution typique** : 2-5 minutes pour toute la suite de tests ⚡
