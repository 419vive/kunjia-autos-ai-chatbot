#!/usr/bin/env python3
"""
Create a Wikidata entity for 崑家汽車 (Kun Motors) via the Wikidata API.

Prerequisites:
1. Create a Wikidata account at https://www.wikidata.org/wiki/Special:CreateAccount
2. Create a bot password at https://www.wikidata.org/wiki/Special:BotPasswords
   - Grant these permissions: editpage, createpage
   - Copy the bot username (e.g., YourUser@BotName) and password
3. Run: python3 scripts/create-wikidata-entity.py
"""

import json
import sys
import requests

API_URL = "https://www.wikidata.org/w/api.php"

# Entity data for 崑家汽車
ENTITY_DATA = {
    "labels": {
        "zh-tw": {"language": "zh-tw", "value": "崑家汽車"},
        "zh-hant": {"language": "zh-hant", "value": "崑家汽車"},
        "zh": {"language": "zh", "value": "崑家汽車"},
        "en": {"language": "en", "value": "Kun Motors"},
    },
    "descriptions": {
        "zh-tw": {"language": "zh-tw", "value": "高雄市三民區二手車商，創立於1986年"},
        "zh-hant": {"language": "zh-hant", "value": "高雄市三民區二手車商，創立於1986年"},
        "zh": {"language": "zh", "value": "高雄市三民区二手车商，创立于1986年"},
        "en": {"language": "en", "value": "Used car dealership in Sanmin District, Kaohsiung, Taiwan, established 1986"},
    },
    "aliases": {
        "zh-tw": [
            {"language": "zh-tw", "value": "崑家中古車"},
            {"language": "zh-tw", "value": "崑家汽車高雄"},
            {"language": "zh-tw", "value": "KUN MOTORS"},
        ],
        "en": [
            {"language": "en", "value": "Kun Family Motors"},
            {"language": "en", "value": "Kun Auto"},
        ],
    },
    "claims": {
        # P31 = instance of → Q53671690 (car dealership)
        "P31": [{"mainsnak": {"snaktype": "value", "property": "P31", "datavalue": {"value": {"entity-type": "item", "numeric-id": 53671690}, "type": "wikibase-entityid"}}, "type": "statement", "rank": "normal"}],
        # P17 = country → Q865 (Taiwan)
        "P17": [{"mainsnak": {"snaktype": "value", "property": "P17", "datavalue": {"value": {"entity-type": "item", "numeric-id": 865}, "type": "wikibase-entityid"}}, "type": "statement", "rank": "normal"}],
        # P131 = located in administrative territorial entity → Q711203 (Sanmin District)
        "P131": [{"mainsnak": {"snaktype": "value", "property": "P131", "datavalue": {"value": {"entity-type": "item", "numeric-id": 711203}, "type": "wikibase-entityid"}}, "type": "statement", "rank": "normal"}],
        # P625 = coordinate location
        "P625": [{"mainsnak": {"snaktype": "value", "property": "P625", "datavalue": {"value": {"latitude": 22.6444, "longitude": 120.3189, "altitude": None, "precision": 0.0001, "globe": "http://www.wikidata.org/entity/Q2"}, "type": "globecoordinate"}}, "type": "statement", "rank": "normal"}],
        # P571 = inception → 1986
        "P571": [{"mainsnak": {"snaktype": "value", "property": "P571", "datavalue": {"value": {"time": "+1986-00-00T00:00:00Z", "timezone": 0, "before": 0, "after": 0, "precision": 9, "calendarmodel": "http://www.wikidata.org/entity/Q1985727"}, "type": "time"}}, "type": "statement", "rank": "normal"}],
        # P856 = official website
        "P856": [{"mainsnak": {"snaktype": "value", "property": "P856", "datavalue": {"value": "https://kuncar.tw", "type": "string"}}, "type": "statement", "rank": "normal"}],
        # P1329 = phone number
        "P1329": [{"mainsnak": {"snaktype": "value", "property": "P1329", "datavalue": {"value": "+886-936-812-818", "type": "string"}}, "type": "statement", "rank": "normal"}],
        # P6375 = street address (zh-tw)
        "P6375": [{"mainsnak": {"snaktype": "value", "property": "P6375", "datavalue": {"value": {"text": "高雄市三民區大順二路269號", "language": "zh-tw"}, "type": "monolingualtext"}}, "type": "statement", "rank": "normal"}],
        # P452 = industry → Q1307823 (used car trade)
        "P452": [{"mainsnak": {"snaktype": "value", "property": "P452", "datavalue": {"value": {"entity-type": "item", "numeric-id": 1307823}, "type": "wikibase-entityid"}}, "type": "statement", "rank": "normal"}],
        # P2013 = Facebook ID
        "P2013": [{"mainsnak": {"snaktype": "value", "property": "P2013", "datavalue": {"value": "hong0961", "type": "string"}}, "type": "statement", "rank": "normal"}],
        # P8971 = LINE official account ID
        "P8971": [{"mainsnak": {"snaktype": "value", "property": "P8971", "datavalue": {"value": "825oftez", "type": "string"}}, "type": "statement", "rank": "normal"}],
        # P276 = location → Q13887 (Kaohsiung)
        "P276": [{"mainsnak": {"snaktype": "value", "property": "P276", "datavalue": {"value": {"entity-type": "item", "numeric-id": 13887}, "type": "wikibase-entityid"}}, "type": "statement", "rank": "normal"}],
    },
}


def login(session, username, password):
    """Login to Wikidata API with bot credentials."""
    # Step 1: Get login token
    r = session.get(API_URL, params={"action": "query", "meta": "tokens", "type": "login", "format": "json"})
    r.raise_for_status()
    login_token = r.json()["query"]["tokens"]["logintoken"]

    # Step 2: Login
    r = session.post(API_URL, data={
        "action": "login",
        "lgname": username,
        "lgpassword": password,
        "lgtoken": login_token,
        "format": "json",
    })
    r.raise_for_status()
    result = r.json()["login"]
    if result["result"] != "Success":
        print(f"Login failed: {result.get('reason', result['result'])}")
        sys.exit(1)
    print(f"Logged in as: {result['lgusername']}")


def get_csrf_token(session):
    """Get a CSRF token for editing."""
    r = session.get(API_URL, params={"action": "query", "meta": "tokens", "format": "json"})
    r.raise_for_status()
    return r.json()["query"]["tokens"]["csrftoken"]


def create_entity(session):
    """Create the Wikidata entity."""
    csrf_token = get_csrf_token(session)

    r = session.post(API_URL, data={
        "action": "wbeditentity",
        "new": "item",
        "data": json.dumps(ENTITY_DATA),
        "summary": "Creating entity for 崑家汽車 (Kun Motors) - used car dealership in Kaohsiung, Taiwan",
        "token": csrf_token,
        "format": "json",
    })
    r.raise_for_status()
    result = r.json()

    if "error" in result:
        print(f"\nError: {result['error']['info']}")
        sys.exit(1)

    entity_id = result["entity"]["id"]
    print(f"\nEntity created successfully!")
    print(f"  Wikidata ID: {entity_id}")
    print(f"  URL: https://www.wikidata.org/wiki/{entity_id}")
    print(f"\nNext step: Add this to your seo.ts sameAs array:")
    print(f'  "https://www.wikidata.org/entity/{entity_id}"')
    return entity_id


def main():
    print("=" * 60)
    print("  Wikidata Entity Creator for 崑家汽車 (Kun Motors)")
    print("=" * 60)
    print()
    print("Prerequisites:")
    print("  1. Wikidata account: https://www.wikidata.org/wiki/Special:CreateAccount")
    print("  2. Bot password:     https://www.wikidata.org/wiki/Special:BotPasswords")
    print("     (grant: editpage, createpage)")
    print()

    username = input("Bot username (e.g., YourUser@BotName): ").strip()
    password = input("Bot password: ").strip()

    if not username or not password:
        print("Username and password are required.")
        sys.exit(1)

    session = requests.Session()
    session.headers.update({"User-Agent": "KunMotorsWikidataBot/1.0 (https://kuncar.tw)"})

    print("\nLogging in...")
    login(session, username, password)

    print("Creating entity...")
    entity_id = create_entity(session)

    # Save the entity ID for later use
    with open("scripts/.wikidata-entity-id", "w") as f:
        f.write(entity_id)
    print(f"\nEntity ID saved to scripts/.wikidata-entity-id")


if __name__ == "__main__":
    main()
