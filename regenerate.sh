#!/bin/bash
# Script pour régénérer un résumé de meeting
# Usage: ./regenerate.sh <meetingId>

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier qu'un ID est fourni
if [ -z "$1" ]; then
    echo -e "${RED}❌ Erreur: Vous devez fournir un meeting ID${NC}"
    echo "Usage: ./regenerate.sh <meetingId>"
    echo ""
    echo "Exemples:"
    echo "  ./regenerate.sh 9e673d01-92b7-41db-951c-ce1bb5887dd6"
    echo "  ./regenerate.sh b45d1cf1-bfd3-439b-975e-7e90579542db"
    exit 1
fi

MEETING_ID=$1

echo -e "${BLUE}🔄 Régénération du résumé pour le meeting: ${MEETING_ID}${NC}"
echo ""

# Charger les variables d'environnement depuis .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Variables d'environnement chargées depuis .env${NC}"
else
    echo -e "${RED}❌ Fichier .env non trouvé${NC}"
    exit 1
fi

# Exécuter le script de régénération
tsx scripts/regenerate-summary.ts "$MEETING_ID"

echo ""
echo -e "${GREEN}✅ Terminé!${NC}"
