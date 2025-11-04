import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
