import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { newPassword } = await request.json();

    // Vérifier que l'utilisateur est connecté
    const currentUser = await requireAuth();

    // Vérifier que c'est l'admin
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (!adminEmail || currentUser.email !== adminEmail) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Validation du nouveau mot de passe
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit contenir au moins 8 caractères" },
        { status: 400 }
      );
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        accounts: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur n'utilise pas OAuth
    if (user.accounts.length > 0) {
      return NextResponse.json(
        {
          error: "Impossible de réinitialiser le mot de passe pour un compte OAuth",
        },
        { status: 400 }
      );
    }

    // Empêcher l'admin de changer son propre mot de passe via cette route
    if (currentUser.id === id) {
      return NextResponse.json(
        {
          error:
            "Utilisez la page des paramètres de compte pour changer votre propre mot de passe",
        },
        { status: 400 }
      );
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      success: true,
      message: `Mot de passe de ${user.email} réinitialisé avec succès`,
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation du mot de passe" },
      { status: 500 }
    );
  }
}
