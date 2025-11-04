import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

interface SendNewAccountNotificationParams {
  userName?: string | null;
  userEmail: string;
  signupMethod: "credentials" | "google";
}

export async function sendNewAccountNotification({
  userName,
  userEmail,
  signupMethod,
}: SendNewAccountNotificationParams) {
  try {
    // L'email de notification (votre email)
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

    if (!adminEmail) {
      console.warn("ADMIN_NOTIFICATION_EMAIL non configuré, email non envoyé");
      return { success: false, error: "Admin email not configured" };
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY non configurée, email non envoyé");
      return { success: false, error: "Resend API key not configured" };
    }

    const signupMethodText =
      signupMethod === "google" ? "Google OAuth" : "Email/Mot de passe";

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: adminEmail,
      subject: `Nouveau compte créé - ${userEmail}`,
      html: `
        <h2>Nouveau compte créé</h2>
        <p>Un nouvel utilisateur vient de créer un compte sur Transcriptor.</p>
        <ul>
          <li><strong>Nom:</strong> ${userName || "Non renseigné"}</li>
          <li><strong>Email:</strong> ${userEmail}</li>
          <li><strong>Méthode d'inscription:</strong> ${signupMethodText}</li>
          <li><strong>Date:</strong> ${new Date().toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
          })}</li>
        </ul>
      `,
    });

    if (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      return { success: false, error };
    }

    console.log("Email de notification envoyé avec succès:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email:", error);
    return { success: false, error };
  }
}

interface SendPasswordResetEmailParams {
  userEmail: string;
  resetToken: string;
}

export async function sendPasswordResetEmail({
  userEmail,
  resetToken,
}: SendPasswordResetEmailParams) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY non configurée, email non envoyé");
      return { success: false, error: "Resend API key not configured" };
    }

    const resetUrl = `${APP_URL}/auth/reset-password?token=${resetToken}`;

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: userEmail,
      subject: "Réinitialisation de votre mot de passe - Transcriptor",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Réinitialisation de mot de passe</h2>
          <p>Vous avez demandé à réinitialiser votre mot de passe sur Transcriptor.</p>
          <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Ou copiez ce lien dans votre navigateur :<br/>
            <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
          </p>
          <p style="color: #666; font-size: 14px;">
            <strong>Ce lien expire dans 1 heure.</strong>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Erreur lors de l'envoi de l'email de reset:", error);
      return { success: false, error };
    }

    console.log("Email de reset envoyé avec succès:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email de reset:", error);
    return { success: false, error };
  }
}
