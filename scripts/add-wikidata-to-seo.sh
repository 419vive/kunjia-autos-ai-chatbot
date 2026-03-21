#!/bin/bash
# After running create-wikidata-entity.py, run this to update seo.ts
# Usage: bash scripts/add-wikidata-to-seo.sh Q123456789

ENTITY_ID="${1:-$(cat scripts/.wikidata-entity-id 2>/dev/null)}"

if [ -z "$ENTITY_ID" ]; then
  echo "Usage: bash scripts/add-wikidata-to-seo.sh Q123456789"
  echo "Or run create-wikidata-entity.py first (saves ID automatically)"
  exit 1
fi

SEO_FILE="kun-auto-chatbot/server/seo.ts"

if ! grep -q "wikidata.org" "$SEO_FILE"; then
  # Add Wikidata URL to the sameAs array in seo.ts
  sed -i "s|\"https://www.abccar.com.tw/dealer/53764\"|\"https://www.abccar.com.tw/dealer/53764\",\n          \"https://www.wikidata.org/entity/${ENTITY_ID}\"|" "$SEO_FILE"
  echo "Added https://www.wikidata.org/entity/${ENTITY_ID} to seo.ts sameAs"
else
  echo "Wikidata URL already exists in seo.ts"
fi
