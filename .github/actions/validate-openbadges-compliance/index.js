const core = require('@actions/core')
const github = require('@actions/github')
const fs = require('fs')
const path = require('path')

async function run() {
  try {
    console.log('Starting OpenBadges compliance validation...')

    const changedFiles = await getChangedFiles()
    console.log(`Checking ${changedFiles.length} changed files for compliance`)

    const complianceIssues = []

    for (const file of changedFiles) {
      const issues = await validateFile(file)
      complianceIssues.push(...issues)
    }

    // Generate compliance report
    const status =
      complianceIssues.length === 0
        ? 'pass'
        : complianceIssues.some(i => i.severity === 'error')
          ? 'fail'
          : 'warning'

    core.setOutput('compliance-status', status)
    core.setOutput('issues-found', complianceIssues.length.toString())

    if (complianceIssues.length > 0) {
      console.log('\n🔍 OpenBadges Compliance Issues Found:')
      for (const issue of complianceIssues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️'
        console.log(`${icon} ${issue.file}: ${issue.message}`)
        if (issue.suggestion) {
          console.log(`   💡 Suggestion: ${issue.suggestion}`)
        }
      }

      if (status === 'fail') {
        core.setFailed(
          `Found ${complianceIssues.filter(i => i.severity === 'error').length} compliance error(s)`
        )
      }
    } else {
      console.log('✅ No OpenBadges compliance issues found')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getChangedFiles() {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.log('No GITHUB_TOKEN available, scanning all relevant files')
    return getAllRelevantFiles()
  }

  try {
    const octokit = github.getOctokit(token)
    const prNumber = github.context.payload.pull_request?.number

    if (!prNumber) {
      console.log('Not in PR context, scanning all relevant files')
      return getAllRelevantFiles()
    }

    const files = await octokit.rest.pulls.listFiles({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber,
    })

    return files.data.map(f => f.filename)
  } catch (error) {
    console.log(`Failed to get changed files: ${error.message}`)
    return getAllRelevantFiles()
  }
}

function getAllRelevantFiles() {
  const relevantExtensions = ['.ts', '.js', '.vue', '.json']
  const relevantDirs = ['src', 'database']
  const files = []

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return

    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDir(fullPath)
      } else if (stat.isFile() && relevantExtensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  }

  for (const dir of relevantDirs) {
    scanDir(dir)
  }

  return files
}

async function validateFile(filePath) {
  const issues = []

  if (!fs.existsSync(filePath)) {
    return issues
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()

    // OpenBadges-specific validation rules
    const validationRules = [
      {
        name: 'Badge Schema Validation',
        pattern: /badge.*schema|schema.*badge/i,
        check: content => {
          // Only enforce strict schema validation on JSON files to avoid false positives in TS/JS
          if (ext !== '.json') return null

          try {
            const json = JSON.parse(content)
            const looksLikeBadge =
              json['@context']?.toString().includes('openbadges') ||
              json.type === 'BadgeClass' ||
              (Array.isArray(json.type) && json.type.includes('BadgeClass')) ||
              json.type === 'Assertion' ||
              (Array.isArray(json.type) && json.type.includes('Assertion'))

            if (!looksLikeBadge) return null

            const requiredFields = ['id', 'type', 'name', 'description', 'image', 'criteria']
            const missingFields = requiredFields.filter(field => !(field in json))

            if (missingFields.length > 0) {
              return {
                severity: 'error',
                message: `Missing required OpenBadges fields: ${missingFields.join(', ')}`,
                suggestion: 'Ensure all required OpenBadges 2.x/3.0 fields are included',
              }
            }
          } catch {
            // Not valid JSON; skip strict validation
            return null
          }
          return null
        },
      },
      {
        name: 'Verification Implementation',
        pattern: /verify.*badge|badge.*verify/i,
        check: content => {
          if (content.includes('verifyBadge') || content.includes('validateBadge')) {
            if (!content.includes('signature') && !content.includes('proof')) {
              return {
                severity: 'error',
                message: 'Badge verification missing cryptographic validation',
                suggestion:
                  'Implement signature or proof verification according to OpenBadges spec',
              }
            }
          }
          return null
        },
      },
      {
        name: 'JSON-LD Context',
        pattern: /\.json$|context|@context/i,
        check: content => {
          if (content.includes('@context') && content.includes('openbadges')) {
            try {
              const json = JSON.parse(content)
              if (
                json['@context'] &&
                !json['@context'].includes('https://w3id.org/openbadges/v2')
              ) {
                return {
                  severity: 'warning',
                  message: 'OpenBadges context URL may be outdated',
                  suggestion:
                    'Use https://w3id.org/openbadges/v2 for OpenBadges 2.x or appropriate 3.0 context',
                }
              }
            } catch {
              // Not valid JSON, skip
            }
          }
          return null
        },
      },
      {
        name: 'API Endpoint Compliance',
        pattern: /app\.(get|post|put|delete)|router\./i,
        check: content => {
          // Check for OpenBadges API endpoints
          if (content.includes('/badges') || content.includes('/assertions')) {
            if (!content.includes('application/json') && !content.includes('Content-Type')) {
              return {
                severity: 'warning',
                message: 'API endpoint should specify Content-Type for OpenBadges compliance',
                suggestion: 'Set Content-Type: application/json for OpenBadges API endpoints',
              }
            }
          }
          return null
        },
      },
      {
        name: 'Cryptographic Security',
        pattern: /crypto|sign|verify|key/i,
        check: content => {
          // Check for weak cryptographic practices
          if (content.includes('md5') || content.includes('sha1')) {
            return {
              severity: 'error',
              message: 'Weak cryptographic hash algorithm detected',
              suggestion:
                'Use SHA-256 or stronger algorithms for OpenBadges cryptographic operations',
            }
          }

          if (
            content.includes('private') &&
            content.includes('key') &&
            !content.includes('process.env')
          ) {
            return {
              severity: 'error',
              message: 'Potential hardcoded private key detected',
              suggestion: 'Store private keys in environment variables or secure key management',
            }
          }

          return null
        },
      },
    ]

    // Apply validation rules
    for (const rule of validationRules) {
      if (rule.pattern.test(content) || rule.pattern.test(fileName)) {
        const result = rule.check(content)
        if (result) {
          issues.push({
            file: filePath,
            rule: rule.name,
            severity: result.severity,
            message: result.message,
            suggestion: result.suggestion,
          })
        }
      }
    }
  } catch (error) {
    console.log(`Error validating file ${filePath}: ${error.message}`)
  }

  return issues
}

run()
