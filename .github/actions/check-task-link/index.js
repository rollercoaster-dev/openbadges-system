const core = require('@actions/core')

async function run() {
  try {
    // Prefer explicit input, but fall back to common env var formats when running as a plain Node script
    const inputFromCore = core.getInput('pr-body')
    const envInput =
      process.env['INPUT_PR_BODY'] || process.env['INPUT_PR-BODY'] || process.env['PR_BODY'] || ''
    const prBody = (inputFromCore || envInput || '').toString()

    console.log('Checking PR for proper task and issue linking...')

    if (!prBody || prBody.trim().length === 0) {
      console.log('No PR body provided. Skipping task/issue link enforcement for this run.')
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
      core.setFailed(`PR must be linked to at least one issue or task. 
      
Please add one of the following to your PR description:
- Link to an issue: "Closes #123" or "Related to #456"
- Link to a task: "Task ID: uuid-here"

This ensures proper tracking and project management integration.`)
    } else {
      console.log('✅ PR properly linked to tasks/issues')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
