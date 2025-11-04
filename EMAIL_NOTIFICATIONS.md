# Configuration des Notifications Email

Ce guide explique comment configurer les notifications email pour recevoir un email à chaque création de compte.

## Service utilisé : Resend

Nous utilisons [Resend](https://resend.com) car il est :
- Simple à configurer
- Parfaitement intégré avec Next.js et Vercel
- Gratuit jusqu'à 3000 emails/mois
- Rapide et fiable

## Configuration en 3 étapes

### 1. Créer un compte Resend

1. Allez sur https://resend.com
2. Créez un compte gratuit
3. Vérifiez votre email

### 2. Obtenir votre clé API

1. Une fois connecté, allez sur https://resend.com/api-keys
2. Cliquez sur "Create API Key"
3. Donnez un nom (ex: "Transcriptor Production")
4. Copiez la clé API (vous ne pourrez pas la revoir)

### 3. Configurer les variables d'environnement

#### En local (.env)

Ajoutez ces variables dans votre fichier `.env` :

```bash
# Clé API Resend
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxx"

# Votre email pour recevoir les notifications
ADMIN_NOTIFICATION_EMAIL="votre.email@example.com"

# Email expéditeur (utilisez onboarding@resend.dev pour les tests)
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

#### Sur Vercel (production)

1. Allez dans votre projet sur Vercel
2. Settings → Environment Variables
3. Ajoutez les 3 variables :
   - `RESEND_API_KEY` : Votre clé API Resend
   - `ADMIN_NOTIFICATION_EMAIL` : Votre email
   - `RESEND_FROM_EMAIL` : `onboarding@resend.dev` (ou votre domaine vérifié)

4. Redéployez votre application

## Utiliser votre propre domaine (optionnel)

Par défaut, les emails sont envoyés depuis `onboarding@resend.dev`, ce qui fonctionne mais peut finir dans les spams.

Pour utiliser votre propre domaine (ex: `notifications@votre-domaine.com`) :

1. Dans Resend, allez sur https://resend.com/domains
2. Cliquez sur "Add Domain"
3. Entrez votre domaine (ex: `votre-domaine.com`)
4. Ajoutez les enregistrements DNS fournis par Resend
5. Attendez la vérification (quelques minutes à quelques heures)
6. Modifiez `RESEND_FROM_EMAIL` dans vos variables d'environnement

## Fonctionnement

Le système envoie automatiquement un email à `ADMIN_NOTIFICATION_EMAIL` quand :
- Un utilisateur crée un compte avec email/mot de passe
- Un utilisateur se connecte avec Google pour la première fois

L'email contient :
- Le nom de l'utilisateur
- Son email
- La méthode d'inscription (Email/Password ou Google OAuth)
- La date et l'heure de création

## Logs et débogage

Les emails sont envoyés de manière asynchrone (non-bloquante) pour ne pas ralentir l'inscription.

Si un email échoue :
- L'inscription fonctionne quand même
- L'erreur est loggée dans la console serveur
- Vérifiez les logs Vercel dans le dashboard

## Tester localement

1. Configurez vos variables d'environnement dans `.env`
2. Démarrez le serveur : `npm run dev`
3. Créez un nouveau compte sur http://localhost:3000/auth/signup
4. Vérifiez votre boîte email

## Sécurité

- ⚠️ Ne committez jamais votre `RESEND_API_KEY` dans Git
- La clé est déjà dans `.gitignore` via le fichier `.env`
- Utilisez des variables d'environnement différentes en local et en production
- Si une clé est compromise, régénérez-la immédiatement sur Resend

## Support

En cas de problème :
- Documentation Resend : https://resend.com/docs
- Support Resend : https://resend.com/support
- Logs Resend : https://resend.com/logs
