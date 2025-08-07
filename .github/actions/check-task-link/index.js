const core = require('@actions/core')
const github = require('@actions/github')

async function run() {
  try {
    const ctx = github.context
    const isPr = Boolean(ctx.payload && ctx.payload.pull_request)
    const defaultBranch =
      ctx.payload && ctx.payload.repository && ctx.payload.repository.default_branch
    const baseBranch = isPr ? ctx.payload.pull_request.base.ref : ''
    const enforce = isPr && defaultBranch && baseBranch === defaultBranch

    // Prefer explicit input, but fall back to common env var formats when running as a plain Node script
    const inputFromCore = core.getInput('pr-body')
    const envInput =
      process.env['INPUT_PR_BODY'] || process.env['INPUT_PR-BODY'] || process.env['PR_BODY'] || ''
    const prBody = (inputFromCore || envInput || '').toString()

    console.log('Checking PR for proper task and issue linking...')
    console.log(
      `Context: isPr=${isPr}, base=${baseBranch}, default=${defaultBranch}, enforce=${enforce}`
    )

    if (!prBody || prBody.trim().length === 0) {
      const msg = 'No PR body provided. Skipping task/issue link enforcement for this run.'
      if (enforce) core.warning(msg)
      else console.log(msg)
      core.setOutput('has-task-link', 'false')
      core.setOutput('linked-issues', '0')
      core.setOutput('linked-tasks', '0')
      return
    }

    // Check for linked issues
    const issuePatterns = [/(?:Closes|Fixes|Resolves)\s+#(\d+)/gi, /(?:Related to|See)\s+#(\d+)/gi]

    const linkedIssues = new Set()
    for (const pattern of issuePatterns) {
      const matches = prBody.matchAll(pattern)
      for (const match of matches) {
        linkedIssues.add(match[1])
      }
    }

    // Check for task IDs
    const taskPatterns = [
      /Task ID:\s*([a-f0-9-]{36})/gi,
      /Task:\s*([a-f0-9-]{36})/gi,
      /Task-ID:\s*([a-f0-9-]{36})/gi,
    ]

    const linkedTasks = new Set()
    for (const pattern of taskPatterns) {
      const matches = prBody.matchAll(pattern)
      for (const match of matches) {
        linkedTasks.add(match[1])
      }
    }

    const hasTaskLink = linkedIssues.size > 0 || linkedTasks.size > 0

    core.setOutput('has-task-link', hasTaskLink.toString())
    core.setOutput('linked-issues', linkedIssues.size.toString())
    core.setOutput('linked-tasks', linkedTasks.size.toString())

    console.log(`Found ${linkedIssues.size} linked issue(s) and ${linkedTasks.size} linked task(s)`)

    if (!hasTaskLink) {
      const failureMsg = `PR must be linked to at least one issue or task.\n\nPlease add one of the following to your PR description:\n- Link to an issue: "Closes #123" or "Related to #456"\n- Link to a task: "Task ID: uuid-here"\n\nThis ensures proper tracking and project management integration.`
      if (enforce) {
        core.setFailed(failureMsg)
      } else {
        core.warning(`Advisory only (non-default base branch):\n${failureMsg}`)
      }
    } else {
      console.log('✅ PR properly linked to tasks/issues')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
