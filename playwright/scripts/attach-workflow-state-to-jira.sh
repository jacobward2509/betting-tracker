#!/usr/bin/env bash
# attach-workflow-state-to-jira.sh
#
# Attaches the .ai/workflow-state.json file to a Jira ticket and posts
# a comment summarizing what was attached, using the same Jira REST API pattern
# already used by attach-test-plan-to-jira.sh and raise-bug-to-jira.sh.
#
# By default, this script only runs when the workflow state file indicates the
# workflow is actually complete (stage == "done" and remainingRepairs == 0) — it
# refuses to run otherwise, since attaching a partially-completed state file to
# a ticket would normally be misleading.
#
# Pass --allow-incomplete to bypass that guard. This is used when a user
# abandons/overwrites an in-progress workflow (see
# playwright/docs/workflows/attach-incomplete-state-to-jira.md) and wants the
# partial state preserved on a ticket before it's lost. In this mode, the
# posted Jira comment is worded differently to make clear the snapshot is
# partial, and summarizes stage/completed/remaining-repairs instead of the
# self-heal/bug/skip breakdown.
#
# Usage:
#   scripts/attach-workflow-state-to-jira.sh <TICKET_KEY> [<STATE_FILE_PATH>] [--allow-incomplete]
#
# Examples:
#   scripts/attach-workflow-state-to-jira.sh API-2806
#   scripts/attach-workflow-state-to-jira.sh API-2806 .ai/workflow-state.json
#   scripts/attach-workflow-state-to-jira.sh API-2806 --allow-incomplete
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

# ---------------------------------------------------------------------------
# Parse arguments, extracting the --allow-incomplete flag wherever it appears.
# ---------------------------------------------------------------------------
ALLOW_INCOMPLETE=false
POSITIONAL_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--allow-incomplete" ]; then
    ALLOW_INCOMPLETE=true
  else
    POSITIONAL_ARGS+=("$arg")
  fi
done

TICKET_KEY="${POSITIONAL_ARGS[0]:-}"
STATE_FILE_PATH="${POSITIONAL_ARGS[1]:-.ai/workflow-state.json}"

if [ -z "$TICKET_KEY" ]; then
  echo "Usage: $0 <TICKET_KEY> [<STATE_FILE_PATH>] [--allow-incomplete]"
  exit 1
fi

# Validate ticket key format (e.g. API-2806)
if ! [[ "$TICKET_KEY" =~ ^[A-Z]+-[0-9]+$ ]]; then
  echo "Error: '$TICKET_KEY' does not look like a valid Jira ticket key (expected format e.g. API-2806)."
  exit 1
fi

# Resolve state file path relative to repo root if it's not already absolute/found as-is
if [ ! -f "$STATE_FILE_PATH" ]; then
  if [ -f "$REPO_ROOT/$STATE_FILE_PATH" ]; then
    STATE_FILE_PATH="$REPO_ROOT/$STATE_FILE_PATH"
  else
    echo "Error: State file not found: $STATE_FILE_PATH"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Guard: only proceed if the workflow is actually complete, unless
# --allow-incomplete was passed.
# ---------------------------------------------------------------------------
STAGE=$(jq -r '.stage // empty' "$STATE_FILE_PATH")
REMAINING_REPAIRS=$(jq -r '.remainingRepairs // 0' "$STATE_FILE_PATH")

if [ "$ALLOW_INCOMPLETE" = false ]; then
  if [ "$STAGE" != "done" ] || [ "$REMAINING_REPAIRS" != "0" ]; then
    echo "Error: Workflow state is not complete (stage=\"$STAGE\", remainingRepairs=$REMAINING_REPAIRS)."
    echo "This script only attaches a workflow state file once stage is \"done\" and remainingRepairs is 0."
    echo "If you intend to attach a partially-completed state file (e.g. before it's overwritten by a new workflow), re-run with --allow-incomplete."
    exit 1
  fi
fi

# Load Jira credentials from playwright/.env.sit, falling back to playwright/.env.dev.
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

echo "Attaching '$STATE_FILE_PATH' to Jira ticket $TICKET_KEY..."
echo "Attachment URL: $JIRA_BASE_URL/rest/api/3/issue/$TICKET_KEY/attachments"

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -u "$JIRA_USER:$JIRA_API_TOKEN" \
  -X POST \
  -H "X-Atlassian-Token: nocheck" \
  -F "file=@${STATE_FILE_PATH}" \
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

# ---------------------------------------------------------------------------
# Build a comment summarizing what was attached.
#
# Complete-workflow format (no failures):
#   Workflow state attached to ticket — all tests passed, no repairs needed.
#
# Complete-workflow format (with failures):
#   Workflow state attached to ticket — workflow complete.
#
#   Self-healed: <n> | Bugs raised: <n> (<KEY1>, <KEY2>) | Skipped: <n>
#
# --allow-incomplete (partial snapshot) format:
#   Partial workflow state attached to ticket — a new task was started before
#   this workflow completed.
#
#   Stage: <stage> | Completed: <completed.join(", ")> | Remaining repairs: <remainingRepairs>
# ---------------------------------------------------------------------------
if [ "$ALLOW_INCOMPLETE" = true ]; then
  COMPLETED_LIST=$(jq -r '(.completed // []) | join(", ")' "$STATE_FILE_PATH")
  if [ -z "$COMPLETED_LIST" ]; then
    COMPLETED_LIST="none"
  fi

  COMMENT_TEXT="Partial workflow state attached to ticket — a new task was started before this workflow completed.

Stage: ${STAGE} | Completed: ${COMPLETED_LIST} | Remaining repairs: ${REMAINING_REPAIRS}"
else
  FAILURE_COUNT=$(jq -r '(.failures // []) | length' "$STATE_FILE_PATH")

  if [ "$FAILURE_COUNT" -eq 0 ]; then
    COMMENT_TEXT="Workflow state attached to ticket — all tests passed, no repairs needed."
  else
    SELF_HEALED_COUNT=$(jq -r '[(.failures // [])[] | select(.decision == "self-heal")] | length' "$STATE_FILE_PATH")
    RAISE_BUG_COUNT=$(jq -r '[(.failures // [])[] | select(.decision == "raise-bug")] | length' "$STATE_FILE_PATH")
    SKIP_COUNT=$(jq -r '[(.failures // [])[] | select(.decision == "skip")] | length' "$STATE_FILE_PATH")
    BUG_TICKETS=$(jq -r '[(.failures // [])[] | select(.decision == "raise-bug") | .bugTicket // empty] | join(", ")' "$STATE_FILE_PATH")

    if [ -n "$BUG_TICKETS" ]; then
      BUG_SUMMARY="Bugs raised: ${RAISE_BUG_COUNT} (${BUG_TICKETS})"
    else
      BUG_SUMMARY="Bugs raised: ${RAISE_BUG_COUNT}"
    fi

    COMMENT_TEXT="Workflow state attached to ticket — workflow complete.

Self-healed: ${SELF_HEALED_COUNT} | ${BUG_SUMMARY} | Skipped: ${SKIP_COUNT}"
  fi
fi

# Split on blank line into separate ADF paragraph nodes (same technique used by
# raise-bug-to-jira.sh) so the two-line summary renders as distinct paragraphs.
ADF_CONTENT="[]"
while IFS= read -r paragraph; do
  if [ -n "$paragraph" ]; then
    ADF_CONTENT=$(jq --arg text "$paragraph" '. + [{"type":"paragraph","content":[{"type":"text","text":$text}]}]' <<< "$ADF_CONTENT")
  fi
done <<< "$COMMENT_TEXT"

COMMENT_PAYLOAD=$(jq -n --argjson content "$ADF_CONTENT" '{
  body: {
    type: "doc",
    version: 1,
    content: $content
  }
}')

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
