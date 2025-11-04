import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Empêcher l'admin de se supprimer lui-même
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte admin" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            meetings: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Supprimer l'utilisateur (cascade delete sur les meetings grâce au schema Prisma)
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Utilisateur ${user.email} supprimé avec succès`,
      deletedMeetings: user._count.meetings,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'utilisateur" },
      { status: 500 }
    );
  }
}
