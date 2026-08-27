#!/usr/bin/env bash
# attach-test-plan-to-jira.sh
#
# Attaches a local file (e.g. a generated test plan markdown file) to a Jira ticket
# and posts a comment noting the attachment, using the same Jira REST API pattern
# already used in playwright/api-test.gitlab-ci.yml.
#
# Usage:
#   scripts/attach-test-plan-to-jira.sh <TICKET_KEY> <FILE_PATH> <OPERATION_ID>
#
# Example:
#   scripts/attach-test-plan-to-jira.sh API-2806 playwright/docs/test-plans/customer/test-plan-update-customer-us.md update-customer-us
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


TICKET_KEY="${1:-}"
FILE_PATH="${2:-}"
OPERATION_ID="${3:-}"

if [ -z "$TICKET_KEY" ] || [ -z "$FILE_PATH" ] || [ -z "$OPERATION_ID" ]; then
  echo "Usage: $0 <TICKET_KEY> <FILE_PATH> <OPERATION_ID>"
  exit 1
fi


# Validate ticket key format (e.g. API-2806)
if ! [[ "$TICKET_KEY" =~ ^[A-Z]+-[0-9]+$ ]]; then
  echo "Error: '$TICKET_KEY' does not look like a valid Jira ticket key (expected format e.g. API-2806)."
  exit 1
fi

# Resolve file path relative to repo root if it's not already absolute/found as-is
if [ ! -f "$FILE_PATH" ]; then
  if [ -f "$REPO_ROOT/$FILE_PATH" ]; then
    FILE_PATH="$REPO_ROOT/$FILE_PATH"
  else
    echo "Error: File not found: $FILE_PATH"
    exit 1
  fi
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

echo "Attaching '$FILE_PATH' to Jira ticket $TICKET_KEY..."
echo "Attachment URL: $JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/attachments"

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X POST \
  -H "X-Atlassian-Token: nocheck" \
  -F "file=@${FILE_PATH}" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/attachments")

HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n1)
BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response: $BODY"

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "✅ Successfully attached file to $TICKET_KEY."
else
  echo "❌ Failed to attach file to $TICKET_KEY."
  exit 1
fi

# Post a comment on the ticket noting the attachment.
# The Jira v3 comment API requires the body in Atlassian Document Format (ADF).
COMMENT_TEXT="Test plan for ${OPERATION_ID} attached to ticket"

# Escape double quotes and backslashes for safe embedding in the JSON payload.
ESCAPED_COMMENT_TEXT=$(printf '%s' "$COMMENT_TEXT" | sed 's/\\/\\\\/g; s/"/\\"/g')

COMMENT_PAYLOAD=$(cat <<EOF
{
  "body": {
    "type": "doc",
    "version": 1,
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "${ESCAPED_COMMENT_TEXT}"
          }
        ]
      }
    ]
  }
}
EOF
)

echo ""
echo "Adding comment to Jira ticket $TICKET_KEY..."
echo "Comment URL: $JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/comment"

COMMENT_RESPONSE=$(curl -s -w "\n%{http_code}" -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$COMMENT_PAYLOAD" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/comment")

COMMENT_HTTP_STATUS=$(echo "$COMMENT_RESPONSE" | tail -n1)
COMMENT_BODY=$(echo "$COMMENT_RESPONSE" | sed '$d')

echo "HTTP Status: $COMMENT_HTTP_STATUS"
echo "Response: $COMMENT_BODY"

if [ "$COMMENT_HTTP_STATUS" -ge 200 ] && [ "$COMMENT_HTTP_STATUS" -lt 300 ]; then
  echo "✅ Successfully added comment to $TICKET_KEY."
  exit 0
else
  echo "❌ Failed to add comment to $TICKET_KEY (attachment was still successful)."
  exit 1
fi

