#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const resultsPath = process.argv[2]
if (!resultsPath) {
  console.error('Usage: node summarize-test-results.js <path-to-results.json>')
  process.exit(1)
}

const raw = fs.readFileSync(path.resolve(resultsPath), 'utf-8')
const json = JSON.parse(raw)

const passed = []
const failed = []
const flaky = []
const skipped = []

function walk(suite, breadcrumb) {
  const title = suite.title || ''
  const bc = breadcrumb ? (title ? `${breadcrumb} > ${title}` : breadcrumb) : title

  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const test of spec.tests || []) {
        const testTitle = spec.title
        const fullBc = bc ? `${bc} > ${testTitle}` : testTitle
        const status = test.status
        const results = test.results || []
        const firstResult = results[0] || {}
        const errors = firstResult.errors || []
        const firstErrMsg = errors[0] ? (errors[0].message || '').split('\n')[0].substring(0, 300) : ''
        const loc = `${spec.file}:${spec.line}`

        if (status === 'expected') {
          passed.push({bc: fullBc, title: testTitle, loc})
        } else if (status === 'unexpected') {
          failed.push({bc: fullBc, title: testTitle, loc, err: firstErrMsg})
        } else if (status === 'flaky') {
          flaky.push({bc: fullBc, title: testTitle, loc})
        } else if (status === 'skipped') {
          skipped.push({bc: fullBc, title: testTitle, loc})
        }
      }
    }
  }

  if (suite.suites) {
    for (const s of suite.suites) {
      walk(s, bc)
    }
  }
}

for (const suite of json.suites || []) {
  walk(suite, '')
}

const total = passed.length + failed.length + flaky.length + skipped.length
const stats = json.stats || {}
const durationMs = stats.duration || 0
const durationStr =
  durationMs >= 60000
    ? `${Math.floor(durationMs / 60000)}m ${((durationMs % 60000) / 1000).toFixed(1)}s`
    : `${(durationMs / 1000).toFixed(1)}s`

console.log('')
console.log('════════════════════════════════════════════════════════════')
console.log('  TEST RUN SUMMARY')
console.log('════════════════════════════════════════════════════════════')
console.log(
  `  Total: ${total}  |  ✅ Passed: ${passed.length}  |  ❌ Failed: ${failed.length}  |  ⚠️  Flaky: ${flaky.length}  |  ⏭️  Skipped: ${skipped.length}`
)
console.log(`  Duration: ${durationStr}`)
console.log('════════════════════════════════════════════════════════════')
console.log('')

// ── PASSED ──────────────────────────────────────────────────────────
if (passed.length > 0) {
  console.log(`✅ Passed (${passed.length})`)
  console.log('─'.repeat(60))
  // Group by parent breadcrumb (everything except the last segment)
  const groups = {}
  for (const t of passed) {
    const parts = t.bc.split(' > ')
    const key = parts.slice(0, -1).join(' > ') || '(root)'
    groups[key] = (groups[key] || 0) + 1
  }
  for (const [groupKey, count] of Object.entries(groups)) {
    console.log(`  ${groupKey}  (${count} test${count !== 1 ? 's' : ''})`)
  }
  console.log('')
}

// ── FAILED ───────────────────────────────────────────────────────────
if (failed.length > 0) {
  console.log(`❌ Failed (${failed.length})`)
  console.log('─'.repeat(60))
  for (let i = 0; i < failed.length; i++) {
    const t = failed[i]
    console.log(`  [${i + 1}] ${t.title}`)
    console.log(`      Breadcrumb : ${t.bc}`)
    console.log(`      Location   : ${t.loc}`)
    console.log(`      Error      : ${t.err || '(no error message captured)'}`)
    console.log('')
  }
}

// ── FLAKY ────────────────────────────────────────────────────────────
if (flaky.length > 0) {
  console.log(`⚠️  Flaky (${flaky.length})`)
  console.log('─'.repeat(60))
  for (const t of flaky) {
    console.log(`  ${t.bc}`)
    console.log(`  Location: ${t.loc}`)
    console.log('')
  }
}

// ── SKIPPED ──────────────────────────────────────────────────────────
if (skipped.length > 0) {
  console.log(`⏭️  Skipped (${skipped.length})`)
  console.log('─'.repeat(60))
  for (const t of skipped) {
    console.log(`  ${t.bc}`)
  }
  console.log('')
}

console.log('════════════════════════════════════════════════════════════')
