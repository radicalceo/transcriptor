import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      );
    }

    // Chercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: true,
      },
    });

    // Pour des raisons de sécurité, on ne dit pas si l'utilisateur existe ou non
    // Mais on ne peut pas envoyer d'email de reset pour un compte OAuth
    if (user && user.accounts.length > 0) {
      return NextResponse.json({
        message: "Si ce compte existe, un email de réinitialisation a été envoyé.",
        info: "Ce compte utilise Google OAuth. Veuillez vous connecter avec Google.",
      });
    }

    if (!user || !user.password) {
      // On retourne un message générique pour ne pas révéler si l'utilisateur existe
      return NextResponse.json({
        message: "Si ce compte existe, un email de réinitialisation a été envoyé.",
      });
    }

    // Générer un token sécurisé
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Expiration dans 1 heure
    const expires = new Date(Date.now() + 3600000);

    // Supprimer les anciens tokens de reset pour cet email
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: email,
      },
    });

    // Créer le token de vérification
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires,
      },
    });

    // Envoyer l'email (non-bloquant)
    sendPasswordResetEmail({
      userEmail: email,
      resetToken,
    }).catch((error) => {
      console.error("Erreur lors de l'envoi de l'email de reset:", error);
    });

    return NextResponse.json({
      message: "Si ce compte existe, un email de réinitialisation a été envoyé.",
    });
  } catch (error) {
    console.error("Error in forgot-password:", error);
    return NextResponse.json(
      { error: "Erreur lors de la demande de réinitialisation" },
      { status: 500 }
    );
  }
}
