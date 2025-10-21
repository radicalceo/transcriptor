# 🚀 Quick Start - Tests E2E

Guide ultra-rapide pour lancer les tests après chaque développement.

## ⚡ 30 secondes pour lancer les tests

```bash
npm run test:e2e
```

C'est tout !

## 📊 Voir les résultats détaillés

```bash
npm run test:e2e:report
```

## 🎨 Mode interface graphique (recommandé pour le dev)

```bash
npm run test:e2e:ui
```

## 🐛 Déboguer un test qui échoue

```bash
npm run test:e2e:debug
```

## ✅ Checklist quotidienne

Avant de commit/push :

```bash
# 1. Lancer les tests
npm run test:e2e

# 2. Si tout est vert ✅, c'est bon !

# 3. Si rouge ❌, voir le rapport :
npm run test:e2e:report
```

## 💡 Commandes utiles

```bash
# Tester uniquement la page d'accueil
npx playwright test e2e/homepage.spec.ts

# Tester avec le navigateur visible
npm run test:e2e:headed

# Mettre à jour les navigateurs (si besoin)
npx playwright install
```

## 📝 Que font ces tests ?

Les tests vérifient automatiquement :
- ✅ Navigation entre les pages
- ✅ Upload de fichiers
- ✅ Démarrage d'un meeting
- ✅ Affichage de la transcription
- ✅ Génération du résumé
- ✅ Historique des meetings

## ⏱️ Temps d'exécution

Environ **2-5 minutes** pour toute la suite.

## 🆘 Problème ?

```bash
# Réinstaller les dépendances
npm install --legacy-peer-deps

# Réinstaller les navigateurs
npx playwright install
```

---

**Besoin de plus d'infos ?** → Voir [README.md](./README.md)
