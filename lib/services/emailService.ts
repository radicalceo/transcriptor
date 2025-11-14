import { Resend } from 'resend'
import type { Summary } from '@/lib/types'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendSummaryReadyEmail(
  userEmail: string,
  meetingId: string,
  meetingTitle: string,
  summary: Summary,
  baseUrl: string
) {
  try {
    // Préparer l'URL du résumé
    const summaryUrl = `${baseUrl}/summary/${meetingId}`

    // Extraire quelques éléments clés du résumé
    const actionsCount = summary.actions.length
    const decisionsCount = summary.decisions.length
    const topicsCount = summary.topics.length

    // Créer l'email HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre résumé de réunion est prêt</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
          ✨ Résumé prêt !
        </h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Bonjour,
        </p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          L'analyse IA de votre réunion <strong>"${meetingTitle}"</strong> est terminée ! 🎉
        </p>

        <!-- Summary Stats -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
          <tr>
            <td style="padding: 10px 0;">
              <div style="display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 10px;">📋</span>
                <span style="color: #6b7280; font-size: 14px;">
                  <strong style="color: #111827; font-size: 20px;">${topicsCount}</strong> sujets abordés
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <div style="display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 10px;">✅</span>
                <span style="color: #6b7280; font-size: 14px;">
                  <strong style="color: #111827; font-size: 20px;">${decisionsCount}</strong> décisions prises
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <div style="display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 10px;">🎯</span>
                <span style="color: #6b7280; font-size: 14px;">
                  <strong style="color: #111827; font-size: 20px;">${actionsCount}</strong> actions à suivre
                </span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Summary Preview -->
        <div style="background-color: #f3f4f6; border-left: 4px solid #667eea; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.5px;">
            Aperçu du résumé
          </p>
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
            ${summary.summary.length > 200 ? summary.summary.substring(0, 200) + '...' : summary.summary}
          </p>
        </div>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${summaryUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                Voir le résumé complet →
              </a>
            </td>
          </tr>
        </table>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
          Vous pouvez également consulter ce résumé à tout moment depuis votre <a href="${baseUrl}/history" style="color: #667eea; text-decoration: none;">historique</a>.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
          Meeting Copilot - Transcription et analyse IA de réunions
        </p>
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 10px 0 0 0;">
          <a href="${baseUrl}" style="color: #667eea; text-decoration: none;">Accéder à l'application</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`

    // Créer le texte brut pour les clients email ne supportant pas le HTML
    const textContent = `
Bonjour,

L'analyse IA de votre réunion "${meetingTitle}" est terminée !

Résumé :
- ${topicsCount} sujets abordés
- ${decisionsCount} décisions prises
- ${actionsCount} actions à suivre

Aperçu :
${summary.summary}

Consultez le résumé complet ici :
${summaryUrl}

---
Meeting Copilot - Transcription et analyse IA de réunions
${baseUrl}
`

    // Envoyer l'email via Resend
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: userEmail,
      subject: `✅ Résumé prêt : ${meetingTitle}`,
      html: htmlContent,
      text: textContent,
    })

    if (error) {
      console.error('❌ Failed to send email:', error)
      throw error
    }

    console.log('✅ Summary email sent successfully:', data?.id)
    return { success: true, emailId: data?.id }
  } catch (error) {
    console.error('❌ Error sending summary email:', error)
    throw error
  }
}
