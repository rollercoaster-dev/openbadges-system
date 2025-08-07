const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const issueNumber = core.getInput('issue-number');
    const prNumber = core.getInput('pr-number');
    const prBody = core.getInput('pr-body');
    const status = core.getInput('status');
    
    console.log(`Updating task status to: ${status}`);
    
    let taskIds = [];
    
    if (issueNumber) {
      // Get task ID from issue
      const issueTaskId = await getTaskIdFromIssue(issueNumber);
      if (issueTaskId) {
        taskIds.push(issueTaskId);
      }
    }
    
    if (prNumber && prBody) {
      // Extract task IDs from PR body
      const prTaskIds = extractTaskIdsFromPR(prBody);
      taskIds = taskIds.concat(prTaskIds);
      
      // Also get task IDs from linked issues
      const linkedIssues = extractLinkedIssues(prBody);
      for (const linkedIssue of linkedIssues) {
        const linkedTaskId = await getTaskIdFromIssue(linkedIssue);
        if (linkedTaskId) {
          taskIds.push(linkedTaskId);
        }
      }
    }
    
    // Remove duplicates
    taskIds = [...new Set(taskIds)];
    
    console.log(`Found task IDs: ${taskIds.join(', ')}`);
    
    // Update each task
    const updatedTasks = [];
    for (const taskId of taskIds) {
      const success = await updateTaskStatus(taskId, status);
      if (success) {
        updatedTasks.push(taskId);
      }
    }
    
    core.setOutput('updated-tasks', updatedTasks.join(','));
    
    if (updatedTasks.length > 0) {
      console.log(`Successfully updated ${updatedTasks.length} task(s)`);
    } else {
      console.log('No tasks were updated');
    }
    
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function getTaskIdFromIssue(issueNumber) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('No GITHUB_TOKEN available, cannot fetch issue');
    return null;
  }
  
  try {
    const octokit = github.getOctokit(token);
    const issue = await octokit.rest.issues.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber
    });
    
    // Extract task ID from issue body
    const taskIdMatch = issue.data.body?.match(/(?:Task ID|### Task ID)\s*\n?\s*([a-f0-9-]{36})/i);
    return taskIdMatch ? taskIdMatch[1] : null;
    
  } catch (error) {
    console.log(`Failed to fetch issue #${issueNumber}: ${error.message}`);
    return null;
  }
}

function extractTaskIdsFromPR(prBody) {
  const taskIds = [];
  
  // Look for task ID patterns in PR body
  const patterns = [
    /Task ID:\s*([a-f0-9-]{36})/gi,
    /Task:\s*([a-f0-9-]{36})/gi,
    /Task-ID:\s*([a-f0-9-]{36})/gi
  ];
  
  for (const pattern of patterns) {
    const matches = prBody.matchAll(pattern);
    for (const match of matches) {
      taskIds.push(match[1]);
    }
  }
  
  return taskIds;
}

function extractLinkedIssues(prBody) {
  const issues = [];
  
  // Look for issue linking patterns
  const patterns = [
    /(?:Closes|Fixes|Resolves)\s+#(\d+)/gi,
    /(?:Related to|See)\s+#(\d+)/gi
  ];
  
  for (const pattern of patterns) {
    const matches = prBody.matchAll(pattern);
    for (const match of matches) {
      issues.push(match[1]);
    }
  }
  
  return issues;
}

async function updateTaskStatus(taskId, status) {
  try {
    // In a real implementation, this would update the task in your task management system
    console.log(`Updating task ${taskId} to status: ${status}`);
    
    // Update local task file for demonstration
    const taskFile = path.join(process.cwd(), 'docs', 'tasks', `${taskId}.json`);
    
    if (fs.existsSync(taskFile)) {
      const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
      task.status = status;
      task.updatedAt = new Date().toISOString();
      
      // Add status change history
      if (!task.statusHistory) {
        task.statusHistory = [];
      }
      task.statusHistory.push({
        status: status,
        timestamp: new Date().toISOString(),
        source: 'github-action'
      });
      
      fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));
      console.log(`Task ${taskId} updated to ${status}`);
      return true;
    } else {
      console.log(`Task file not found: ${taskFile}`);
      return false;
    }
    
  } catch (error) {
    console.log(`Failed to update task ${taskId}: ${error.message}`);
    return false;
  }
}

run();
