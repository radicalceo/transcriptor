# Notification Email Après Génération du Résumé

**Date** : 13 novembre 2025
**Version** : 1.0

## 📋 Résumé

Cette fonctionnalité améliore l'UX en fin de session live en :
1. Redirigeant vers une page de confirmation au lieu d'un long loading
2. Envoyant automatiquement un email quand le résumé est prêt
3. Permettant à l'utilisateur de fermer l'onglet sans attendre

## 🎯 Objectif

Avant ce changement, après avoir terminé un meeting live (audio-only ou screen-share), l'utilisateur était redirigé vers `/summary/[id]` qui affichait un long loading pendant la génération du résumé (pouvant prendre 30s à 2min).

Maintenant, l'utilisateur est redirigé vers `/meeting/[id]/processing` qui :
- Affiche un message rassurant
- Indique qu'un email sera envoyé
- Permet de quitter la page sans perdre le résumé
- Se met à jour automatiquement quand le résumé est prêt (polling toutes les 5s)

## 📦 Fichiers Créés

### 1. `/app/meeting/[id]/processing/page.tsx`
Page de confirmation affichée après la fin d'un meeting live.

**Caractéristiques** :
- Animation de loading élégante
- Timer affichant le temps écoulé
- Message d'email avec l'adresse de l'utilisateur
- Progression des étapes (transcription, analyse, résumé)
- Polling automatique toutes les 5s pour détecter quand le résumé est prêt
- Redirection automatique vers `/summary/[id]` quand prêt
- Boutons de navigation vers historique et nouveau meeting

### 2. `/lib/services/emailService.ts`
Service d'envoi d'emails utilisant Resend.

**Fonction principale** : `sendSummaryReadyEmail()`

**Paramètres** :
- `userEmail` : Email du destinataire
- `meetingId` : ID du meeting
- `meetingTitle` : Titre du meeting
- `summary` : Objet Summary complet
- `baseUrl` : URL de base de l'application

**Email envoyé** :
- ✅ Template HTML responsive
- 📊 Statistiques du résumé (topics, décisions, actions)
- 📝 Aperçu du résumé (premiers 200 caractères)
- 🔗 Bouton CTA vers le résumé complet
- 📧 Version texte brut pour clients email sans HTML

## 🔧 Fichiers Modifiés

### 1. `/app/api/summary/route.ts`

**Ajout** : Import du service email
```typescript
import { sendSummaryReadyEmail } from '@/lib/services/emailService'
```

**Modification** : Fonction `generateSummaryAsync()`
Ajout du bloc d'envoi d'email à la fin de la génération :

```typescript
// Send email notification
try {
  const meetingWithUser = await retryOperation(() =>
    prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { user: true },
    })
  )

  if (meetingWithUser && meetingWithUser.user.email) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const meetingTitle = meetingWithUser.title || `Meeting ${meetingId.slice(0, 8)}`

    await sendSummaryReadyEmail(
      meetingWithUser.user.email,
      meetingId,
      meetingTitle,
      summary,
      baseUrl
    )
  }
} catch (emailError) {
  console.error(`⚠️ Failed to send email notification:`, emailError)
}
```

### 2. `/app/meeting/audio-only/[id]/page.tsx`

**Ligne 412** : Changement de redirection
```typescript
// Avant
router.push(`/summary/${meetingId}`)

// Après
router.push(`/meeting/${meetingId}/processing`)
```

### 3. `/app/meeting/screen-share/[id]/page.tsx`

**Ligne 498** : Changement de redirection
```typescript
// Avant
router.push(`/summary/${meetingId}`)

// Après
router.push(`/meeting/${meetingId}/processing`)
```

### 4. `.env.local`

**Ajout** : Variable d'environnement pour l'URL de base
```bash
# URL de base de l'application (pour les emails)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

En production, cette variable doit être définie avec l'URL réelle :
```bash
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

## 🔄 Flux Complet

### Avant
```
User termine meeting
  ↓
Appel API /api/summary (async: true)
  ↓
Redirection vers /summary/[id]
  ↓
Long loading + polling toutes les 2s
  ↓
Affichage du résumé
```

### Après
```
User termine meeting
  ↓
Appel API /api/summary (async: true)
  ↓
Redirection vers /meeting/[id]/processing
  ↓
Page de confirmation + message email
  ↓
(En arrière-plan) Génération du résumé
  ↓
Envoi d'email avec lien vers le résumé
  ↓
Polling toutes les 5s sur la page processing
  ↓
Auto-redirection vers /summary/[id] quand prêt
```

## 📧 Template Email

L'email envoyé contient :

**Header** : Gradient violet avec titre "✨ Résumé prêt !"

**Corps** :
- Message de bienvenue personnalisé avec le titre du meeting
- Statistiques visuelles (icônes + chiffres) :
  - 📋 X sujets abordés
  - ✅ X décisions prises
  - 🎯 X actions à suivre
- Aperçu du résumé (premiers 200 caractères)
- Bouton CTA stylisé vers le résumé complet
- Lien vers l'historique

**Footer** :
- Nom de l'application
- Lien vers l'accueil

## 🔍 Logs de Debug

Lors de la génération du résumé, vous devriez voir dans les logs :

```
🔄 Starting async summary generation for meeting [id]
🤖 Generating summary with Claude...
✅ Async summary generation completed for meeting [id]
📧 Sending email notification to user@example.com
✅ Email notification sent successfully
```

## ⚠️ Points d'Attention

1. **Variable d'environnement** : `NEXT_PUBLIC_APP_URL` doit être définie en production
2. **Resend** : La clé API Resend doit être valide (`RESEND_API_KEY`)
3. **Email expéditeur** : `RESEND_FROM_EMAIL` doit être un email vérifié dans Resend (ou `onboarding@resend.dev` pour les tests)
4. **Gestion d'erreurs** : L'envoi d'email est en try/catch pour ne pas bloquer le processus si l'email échoue

## 🧪 Test

Pour tester la fonctionnalité :

1. Démarrer un meeting live (audio-only ou screen-share)
2. Parler quelques mots pour avoir une transcription
3. Terminer le meeting
4. Vérifier la redirection vers `/meeting/[id]/processing`
5. Vérifier l'affichage de la page de confirmation
6. Attendre la génération du résumé (30s-2min)
7. Vérifier la réception de l'email
8. Vérifier la redirection automatique vers `/summary/[id]`

## 🚀 Améliorations Futures

- [ ] Notifications push (Web Push API)
- [ ] Personnalisation du template email
- [ ] Email digest quotidien/hebdomadaire
- [ ] Choix de l'utilisateur de recevoir ou non l'email
- [ ] Webhooks pour intégrations tierces
