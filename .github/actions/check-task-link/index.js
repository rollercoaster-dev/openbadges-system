const core = require('@actions/core');

async function run() {
  try {
    const prBody = core.getInput('pr-body');
    
    console.log('Checking PR for proper task and issue linking...');
    
    // Check for linked issues
    const issuePatterns = [
      /(?:Closes|Fixes|Resolves)\s+#(\d+)/gi,
      /(?:Related to|See)\s+#(\d+)/gi
    ];
    
    const linkedIssues = new Set();
    for (const pattern of issuePatterns) {
      const matches = prBody.matchAll(pattern);
      for (const match of matches) {
        linkedIssues.add(match[1]);
      }
    }
    
    // Check for task IDs
    const taskPatterns = [
      /Task ID:\s*([a-f0-9-]{36})/gi,
      /Task:\s*([a-f0-9-]{36})/gi,
      /Task-ID:\s*([a-f0-9-]{36})/gi
    ];
    
    const linkedTasks = new Set();
    for (const pattern of taskPatterns) {
      const matches = prBody.matchAll(pattern);
      for (const match of matches) {
        linkedTasks.add(match[1]);
      }
    }
    
    const hasTaskLink = linkedIssues.size > 0 || linkedTasks.size > 0;
    
    core.setOutput('has-task-link', hasTaskLink.toString());
    core.setOutput('linked-issues', linkedIssues.size.toString());
    core.setOutput('linked-tasks', linkedTasks.size.toString());
    
    console.log(`Found ${linkedIssues.size} linked issue(s) and ${linkedTasks.size} linked task(s)`);
    
    if (!hasTaskLink) {
      core.setFailed(`PR must be linked to at least one issue or task. 
      
Please add one of the following to your PR description:
- Link to an issue: "Closes #123" or "Related to #456"
- Link to a task: "Task ID: uuid-here"

This ensures proper tracking and project management integration.`);
    } else {
      console.log('✅ PR properly linked to tasks/issues');
    }
    
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
