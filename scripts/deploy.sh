#!/usr/bin/env bash
# Novogenics — Production deployment script
# Usage:
#   ./scripts/deploy.sh rules       — deploy Firestore + Storage rules only
#   ./scripts/deploy.sh indexes     — deploy Firestore indexes only
#   ./scripts/deploy.sh hosting     — build + deploy hosting only
#   ./scripts/deploy.sh all         — build + deploy everything
#   ./scripts/deploy.sh verify      — run pre-deploy checks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SA_FILE="$PROJECT_DIR/service-account.json"
FIREBASE_BIN="$PROJECT_DIR/node_modules/.bin/firebase"

# Load service account for Firebase CLI auth
if [ -f "$SA_FILE" ]; then
  export GOOGLE_APPLICATION_CREDENTIALS="$SA_FILE"
  echo "🔑  Using service account: service-account.json"
elif [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo "❌  No service account found."
  echo "    Place service-account.json in the project root, or set GOOGLE_APPLICATION_CREDENTIALS."
  echo "    Get it from: Firebase Console → Project Settings → Service Accounts"
  exit 1
fi

PROJECT_ID="gen-lang-client-0344977334"
DB_ID="ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a"

cd "$PROJECT_DIR"

case "${1:-all}" in
  rules)
    echo "📋  Deploying Firestore rules..."
    "$FIREBASE_BIN" deploy --only firestore:rules --project "$PROJECT_ID"
    echo "📋  Deploying Storage rules..."
    "$FIREBASE_BIN" deploy --only storage --project "$PROJECT_ID"
    echo "✅  Rules deployed."
    ;;

  indexes)
    echo "🗂   Deploying Firestore indexes..."
    "$FIREBASE_BIN" deploy --only firestore:indexes --project "$PROJECT_ID"
    echo "✅  Indexes deployed."
    ;;

  hosting)
    echo "🏗   Building..."
    npm run build
    echo "🚀  Deploying hosting..."
    "$FIREBASE_BIN" deploy --only hosting --project "$PROJECT_ID"
    echo "✅  Hosting deployed."
    ;;

  all)
    echo "🏗   Building..."
    npm run build
    echo "🚀  Deploying everything..."
    "$FIREBASE_BIN" deploy --project "$PROJECT_ID"
    echo "✅  Full deployment complete."
    ;;

  verify)
    echo "🔍  Running pre-deploy verification..."
    node scripts/admin.mjs verify
    ;;

  *)
    echo "Usage: ./scripts/deploy.sh [rules|indexes|hosting|all|verify]"
    exit 1
    ;;
esac
