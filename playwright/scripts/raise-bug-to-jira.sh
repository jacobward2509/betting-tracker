#!/usr/bin/env bash
# raise-bug-to-jira.sh
#
# Creates a new Jira Bug ticket from a self-heal failure investigation, and
# optionally links it to a related ticket (e.g. the ticket for the branch
# whose Playwright tests surfaced the bug) and/or sets a parent/epic on the
# new bug, using the same Jira REST API pattern already used by
# attach-test-plan-to-jira.sh.
#
# Usage:
#   scripts/raise-bug-to-jira.sh <PROJECT_KEY> <SUMMARY> <DESCRIPTION_FILE> [<LINKED_TICKET_KEY>] [<PARENT_EPIC_KEY>]
#
# Example:
#   scripts/raise-bug-to-jira.sh API "[PUT /customers/{customerId}] Returns 500 instead of 400 for invalid postcode" \
#     /tmp/bug-description.txt API-2806 API-2000
#
# Required environment variables (loaded from playwright/.env.sit, falling back to
# playwright/.env.dev if not already present in the environment):
#   JIRA_BASE_URL   e.g. https://cityelectric.atlassian.net
#   JIRA_USER       Your Jira account email
#   JIRA_API_TOKEN  Your Jira API token (used as the password for basic auth)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAYWRIGHT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PLAYWRIGHT_DIR/.." && pwd)"

PROJECT_KEY="${1:-}"
SUMMARY="${2:-}"
DESCRIPTION_FILE="${3:-}"
LINKED_TICKET_KEY="${4:-}"
PARENT_EPIC_KEY="${5:-}"

if [ -z "$PROJECT_KEY" ] || [ -z "$SUMMARY" ] || [ -z "$DESCRIPTION_FILE" ]; then
  echo "Usage: $0 <PROJECT_KEY> <SUMMARY> <DESCRIPTION_FILE> [<LINKED_TICKET_KEY>] [<PARENT_EPIC_KEY>]"
  exit 1
fi

# Validate project key format (e.g. API)
if ! [[ "$PROJECT_KEY" =~ ^[A-Z][A-Z0-9]+$ ]]; then
  echo "Error: '$PROJECT_KEY' does not look like a valid Jira project key (expected format e.g. API)."
  exit 1
fi

# Resolve description file path relative to repo root if it's not already absolute/found as-is
if [ ! -f "$DESCRIPTION_FILE" ]; then
  if [ -f "$REPO_ROOT/$DESCRIPTION_FILE" ]; then
    DESCRIPTION_FILE="$REPO_ROOT/$DESCRIPTION_FILE"
  else
    echo "Error: Description file not found: $DESCRIPTION_FILE"
    exit 1
  fi
fi

# Validate linked ticket key format if provided (e.g. API-2806)
if [ -n "$LINKED_TICKET_KEY" ] && ! [[ "$LINKED_TICKET_KEY" =~ ^[A-Z]+-[0-9]+$ ]]; then
  echo "Error: '$LINKED_TICKET_KEY' does not look like a valid Jira ticket key (expected format e.g. API-2806)."
  exit 1
fi

# Validate parent/epic key format if provided (e.g. API-2000)
if [ -n "$PARENT_EPIC_KEY" ] && ! [[ "$PARENT_EPIC_KEY" =~ ^[A-Z]+-[0-9]+$ ]]; then
  echo "Error: '$PARENT_EPIC_KEY' does not look like a valid Jira ticket key (expected format e.g. API-2000)."
  exit 1
fi

# Load Jira credentials from playwright/.env.sit, falling back to playwright/.env.dev.
# Sources the whole env file (these are simple KEY=VALUE files) rather than using
# process substitution, which is unreliable in some shell/CI execution contexts.
load_env_file() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090,SC1091
    source "$env_file"
    set +a
  fi
}

if [ -z "${JIRA_BASE_URL:-}" ] || [ -z "${JIRA_USER:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
  load_env_file "$REPO_ROOT/playwright/.env.sit"
fi

if [ -z "${JIRA_BASE_URL:-}" ] || [ -z "${JIRA_USER:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
  load_env_file "$REPO_ROOT/playwright/.env.dev"
fi

if [ -z "${JIRA_BASE_URL:-}" ] || [ -z "${JIRA_USER:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
  echo "Error: Missing one or more required Jira environment variables (JIRA_BASE_URL, JIRA_USER, JIRA_API_TOKEN)."
  echo "Please populate these in playwright/.env.sit or playwright/.env.dev."
  exit 1
fi

# ---------------------------------------------------------------------------
# Build the ADF (Atlassian Document Format) description body.
# The description file is split on blank lines into separate paragraph nodes,
# so multi-paragraph descriptions (Steps to Reproduce, Expected, Actual, etc.)
# render as distinct paragraphs in Jira rather than one wall of text.
#
# Fenced code blocks (```json ... ``` / ``` ... ```) — used for the Request
# Body / Response Body sections — are detected and emitted as ADF `codeBlock`
# nodes instead, so the captured JSON payloads render monospaced/formatted
# rather than as a plain paragraph.
# ---------------------------------------------------------------------------
build_adf_paragraphs() {
  local file="$1"
  local paragraph=""
  local json_paragraphs="[]"
  local in_code_block=false
  local code_lang=""
  local code_content=""

  flush_paragraph() {
    if [ -n "$paragraph" ]; then
      json_paragraphs=$(jq --arg text "$paragraph" '. + [{"type":"paragraph","content":[{"type":"text","text":$text}]}]' <<< "$json_paragraphs")
      paragraph=""
    fi
  }

  flush_code_block() {
    if [ -n "$code_content" ]; then
      json_paragraphs=$(jq --arg text "$code_content" --arg lang "$code_lang" \
        '. + [{"type":"codeBlock","attrs":(if $lang != "" then {"language":$lang} else {}end),"content":[{"type":"text","text":$text}]}]' \
        <<< "$json_paragraphs")
    fi
    in_code_block=false
    code_lang=""
    code_content=""
  }

  # Use python-free, jq-based JSON string escaping for safety with special characters.
  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$in_code_block" = true ]; then
      if [[ "$line" =~ ^\`\`\`[[:space:]]*$ ]]; then
        flush_code_block
      elif [ -n "$code_content" ]; then
        code_content="${code_content}
${line}"
      else
        code_content="$line"
      fi
      continue
    fi

    if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
      flush_paragraph
      in_code_block=true
      code_lang="${BASH_REMATCH[1]}"
      code_content=""
      continue
    fi

    if [ -z "$line" ]; then
      flush_paragraph
    else
      if [ -n "$paragraph" ]; then
        paragraph="${paragraph}
${line}"
      else
        paragraph="$line"
      fi
    fi
  done < "$file"

  # Defensive: file ended mid code-block (missing closing fence) — flush what we have.
  if [ "$in_code_block" = true ]; then
    flush_code_block
  fi

  flush_paragraph

  echo "$json_paragraphs"
}


ADF_CONTENT=$(build_adf_paragraphs "$DESCRIPTION_FILE")

ISSUE_PAYLOAD=$(jq -n \
  --arg projectKey "$PROJECT_KEY" \
  --arg summary "$SUMMARY" \
  --argjson content "$ADF_CONTENT" \
  '{
    fields: {
      project: { key: $projectKey },
      summary: $summary,
      issuetype: { name: "Bug" },
      description: {
        type: "doc",
        version: 1,
        content: $content
      }
    }
  }')

# If a parent/epic key was provided, set it on the issue at creation time via
# the `fields.parent` property. This is the standard Jira Cloud field for
# hierarchy links (works for both classic sub-task-style parents and
# next-gen/team-managed project epic links), so no separate API call is
# needed here (unlike the "Relates" link to LINKED_TICKET_KEY below, which
# must be created via a separate issueLink call after the issue exists).
if [ -n "$PARENT_EPIC_KEY" ]; then
  ISSUE_PAYLOAD=$(echo "$ISSUE_PAYLOAD" | jq --arg parentKey "$PARENT_EPIC_KEY" '.fields.parent = { key: $parentKey }')
fi

echo "Creating Jira bug ticket in project '$PROJECT_KEY'..."
if [ -n "$PARENT_EPIC_KEY" ]; then
  echo "Parent/epic: $PARENT_EPIC_KEY"
fi
echo "Create URL: $JIRA_BASE_URL/rest/api/3/issue"

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$ISSUE_PAYLOAD" \
  "$JIRA_BASE_URL/rest/api/3/issue")

HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n1)
BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response: $BODY"

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  NEW_TICKET_KEY=$(echo "$BODY" | jq -r '.key // empty')
  if [ -z "$NEW_TICKET_KEY" ]; then
    echo "❌ Ticket appeared to be created but no key was returned in the response."
    exit 1
  fi
  echo "✅ Successfully created bug ticket $NEW_TICKET_KEY."
  echo "🔗 $JIRA_BASE_URL/browse/$NEW_TICKET_KEY"
  if [ -n "$PARENT_EPIC_KEY" ]; then
    echo "✅ Set parent/epic to $PARENT_EPIC_KEY."
  fi
else
  echo "❌ Failed to create bug ticket."
  exit 1
fi

# ---------------------------------------------------------------------------
# Optionally link the new bug to a related ticket (e.g. the branch's ticket).
# ---------------------------------------------------------------------------
if [ -n "$LINKED_TICKET_KEY" ]; then
  echo ""
  echo "Linking $NEW_TICKET_KEY to $LINKED_TICKET_KEY (link type: Relates)..."
  echo "Link URL: $JIRA_BASE_URL/rest/api/3/issueLink"

  LINK_PAYLOAD=$(jq -n \
    --arg inward "$NEW_TICKET_KEY" \
    --arg outward "$LINKED_TICKET_KEY" \
    '{
      type: { name: "Relates" },
      inwardIssue: { key: $inward },
      outwardIssue: { key: $outward }
    }')

  LINK_RESPONSE=$(curl -s -w "\n%{http_code}" -u "$JIRA_USER:$JIRA_API_TOKEN" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$LINK_PAYLOAD" \
    "$JIRA_BASE_URL/rest/api/3/issueLink")

  LINK_HTTP_STATUS=$(echo "$LINK_RESPONSE" | tail -n1)
  LINK_BODY=$(echo "$LINK_RESPONSE" | sed '$d')

  echo "HTTP Status: $LINK_HTTP_STATUS"
  if [ -n "$LINK_BODY" ]; then
    echo "Response: $LINK_BODY"
  fi

  if [ "$LINK_HTTP_STATUS" -ge 200 ] && [ "$LINK_HTTP_STATUS" -lt 300 ]; then
    echo "✅ Successfully linked $NEW_TICKET_KEY to $LINKED_TICKET_KEY."
  else
    echo "❌ Failed to link $NEW_TICKET_KEY to $LINKED_TICKET_KEY (ticket creation was still successful)."
    exit 1
  fi
fi

echo ""
echo "NEW_TICKET_KEY=$NEW_TICKET_KEY"
exit 0
