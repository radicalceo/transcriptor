import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultTemplates = [
  {
    name: 'Meeting Standard',
    description: 'Template par défaut pour toute réunion',
    isDefault: true,
    structure: JSON.stringify({
      sections: [
        { key: 'summary', label: 'Synthèse', type: 'text', required: true },
        { key: 'actions', label: 'Actions à suivre', type: 'action_list', required: true },
        { key: 'topics', label: 'Grands sujets abordés', type: 'topic_list', required: true },
        { key: 'decisions', label: 'Décisions', type: 'decision_list', required: true },
        { key: 'open_questions', label: 'Questions ouvertes et follow-ups', type: 'text_list', required: false },
      ],
      prompt: `Génère un résumé structuré de cette réunion.
Retourne un JSON avec :
- summary: Résumé clair et concis de la réunion
- topics: Liste des grands thèmes abordés (format: [{title: string, summary: string}])
- decisions: Liste des décisions prises (format: [{text: string}])
- actions: Liste des actions à suivre (format: [{text: string, assignee?: string, due_date?: string}])
- open_questions: Questions ouvertes ou points à clarifier (format: string[])`,
    }),
  },
  {
    name: 'Customer Discovery',
    description: 'Pour les entretiens de découverte client',
    isDefault: true,
    structure: JSON.stringify({
      sections: [
        { key: 'summary', label: 'Synthèse de l\'entretien', type: 'text', required: true },
        { key: 'pain_points', label: 'Pain points identifiés', type: 'text_list', required: true },
        { key: 'opportunities', label: 'Opportunités', type: 'text_list', required: true },
        { key: 'objections', label: 'Objections et freins', type: 'text_list', required: false },
        { key: 'actions', label: 'Actions de suivi', type: 'action_list', required: true },
        { key: 'customer_profile', label: 'Profil client', type: 'text', required: false },
      ],
      prompt: `Analyse cet entretien de découverte client.
Retourne un JSON avec :
- summary: Synthèse de l'entretien
- pain_points: Liste des problèmes/besoins exprimés par le client
- opportunities: Opportunités business identifiées
- objections: Objections ou freins mentionnés
- actions: Actions de suivi (format: [{text: string, assignee?: string, due_date?: string}])
- customer_profile: Description du profil du client`,
    }),
  },
  {
    name: 'One-on-One',
    description: 'Pour les entretiens individuels',
    isDefault: true,
    structure: JSON.stringify({
      sections: [
        { key: 'summary', label: 'Résumé', type: 'text', required: true },
        { key: 'wins', label: 'Réussites et points positifs', type: 'text_list', required: false },
        { key: 'challenges', label: 'Défis et difficultés', type: 'text_list', required: false },
        { key: 'goals', label: 'Objectifs fixés', type: 'text_list', required: true },
        { key: 'actions', label: 'Actions à suivre', type: 'action_list', required: true },
        { key: 'feedback', label: 'Feedback échangé', type: 'text', required: false },
      ],
      prompt: `Résume cet entretien one-on-one.
Retourne un JSON avec :
- summary: Résumé de la conversation
- wins: Points positifs et réussites mentionnés
- challenges: Défis ou difficultés exprimés
- goals: Objectifs fixés pour la période à venir
- actions: Actions concrètes à suivre (format: [{text: string, assignee?: string, due_date?: string}])
- feedback: Feedback échangé pendant l'entretien`,
    }),
  },
  {
    name: 'Interview',
    description: 'Pour les entretiens de recrutement',
    isDefault: true,
    structure: JSON.stringify({
      sections: [
        { key: 'summary', label: 'Impression générale', type: 'text', required: true },
        { key: 'strengths', label: 'Points forts', type: 'text_list', required: true },
        { key: 'weaknesses', label: 'Points d\'amélioration', type: 'text_list', required: false },
        { key: 'technical_skills', label: 'Compétences techniques', type: 'text_list', required: false },
        { key: 'soft_skills', label: 'Soft skills', type: 'text_list', required: false },
        { key: 'cultural_fit', label: 'Cultural fit', type: 'text', required: false },
        { key: 'actions', label: 'Prochaines étapes', type: 'action_list', required: true },
      ],
      prompt: `Résume cet entretien de recrutement.
Retourne un JSON avec :
- summary: Impression générale du candidat
- strengths: Points forts identifiés
- weaknesses: Points d'amélioration ou faiblesses
- technical_skills: Compétences techniques évaluées
- soft_skills: Soft skills observés
- cultural_fit: Adéquation avec la culture d'entreprise
- actions: Prochaines étapes (format: [{text: string, assignee?: string, due_date?: string}])`,
    }),
  },
  {
    name: 'Standup / Sprint Planning',
    description: 'Pour les daily standups et planifications de sprint',
    isDefault: true,
    structure: JSON.stringify({
      sections: [
        { key: 'summary', label: 'Résumé', type: 'text', required: true },
        { key: 'completed', label: 'Terminé depuis le dernier standup', type: 'text_list', required: false },
        { key: 'in_progress', label: 'En cours', type: 'text_list', required: true },
        { key: 'planned', label: 'Planifié pour le prochain sprint', type: 'text_list', required: false },
        { key: 'blockers', label: 'Blocages et obstacles', type: 'text_list', required: false },
        { key: 'actions', label: 'Actions à suivre', type: 'action_list', required: true },
      ],
      prompt: `Résume ce standup ou sprint planning.
Retourne un JSON avec :
- summary: Résumé de la session
- completed: Tâches terminées depuis le dernier standup
- in_progress: Tâches en cours
- planned: Tâches planifiées pour le prochain sprint
- blockers: Blocages identifiés
- actions: Actions pour débloquer ou avancer (format: [{text: string, assignee?: string, due_date?: string}])`,
    }),
  },
]

async function main() {
  console.log('🌱 Starting seed...')

  // Create default templates
  console.log('📝 Creating default templates...')
  for (const template of defaultTemplates) {
    const existing = await prisma.template.findFirst({
      where: { name: template.name, userId: null },
    })

    if (!existing) {
      await prisma.template.create({
        data: template,
      })
      console.log(`  ✓ Created template: ${template.name}`)
    } else {
      console.log(`  ⊘ Template already exists: ${template.name}`)
    }
  }

  console.log('✅ Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
