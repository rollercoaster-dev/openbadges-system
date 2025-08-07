const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function run() {
  try {
    const issueNumber = core.getInput('issue-number');
    const issueTitle = core.getInput('issue-title');
    const issueBody = core.getInput('issue-body');
    const issueLabels = core.getInput('issue-labels').split(',').map(l => l.trim()).filter(l => l);
    
    console.log(`Processing issue #${issueNumber}: ${issueTitle}`);
    
    // Extract task ID from issue body if present
    const taskIdMatch = issueBody.match(/(?:Task ID|### Task ID)\s*\n?\s*([a-f0-9-]{36})/i);
    const existingTaskId = taskIdMatch ? taskIdMatch[1] : null;
    
    // Parse issue template fields
    const task = parseIssueToTask(issueNumber, issueTitle, issueBody, issueLabels);
    
    if (existingTaskId) {
      // Update existing task
      console.log(`Updating existing task: ${existingTaskId}`);
      await updateExistingTask(existingTaskId, task);
      core.setOutput('task-id', existingTaskId);
    } else {
      // Create new task
      const newTaskId = uuidv4();
      task.id = newTaskId;
      console.log(`Creating new task: ${newTaskId}`);
      await createNewTask(task);
      core.setOutput('task-id', newTaskId);
      
      // Update the issue with the task ID
      await addTaskIdToIssue(issueNumber, newTaskId);
    }
    
  } catch (error) {
    core.setFailed(error.message);
  }
}

function parseIssueToTask(issueNumber, issueTitle, issueBody, issueLabels) {
  // Remove label prefixes from title
  const cleanTitle = issueTitle.replace(/^\[.*?\]\s*/, '');
  
  // Extract fields from issue template
  const description = extractField(issueBody, 'Description') || 
                     extractField(issueBody, 'Bug Description') || 
                     extractField(issueBody, 'Task Description') || '';
  
  const component = extractField(issueBody, 'Component') || 'Unknown';
  const priority = extractField(issueBody, 'Priority') || 'Medium';
  const estimate = extractField(issueBody, 'Time Estimate') || '';
  const acceptanceCriteria = extractField(issueBody, 'Acceptance Criteria') || '';
  
  // Determine task type from labels or title
  let taskType = 'Feature';
  if (issueLabels.includes('bug') || issueTitle.includes('[BUG]')) {
    taskType = 'Bug Fix';
  } else if (issueLabels.includes('task') || issueTitle.includes('[TASK]')) {
    taskType = 'Task';
  }
  
  return {
    name: cleanTitle,
    description: description,
    component: component,
    priority: priority,
    estimate: estimate,
    acceptanceCriteria: acceptanceCriteria,
    taskType: taskType,
    githubIssue: issueNumber,
    status: 'NOT_STARTED',
    labels: issueLabels,
    createdAt: new Date().toISOString()
  };
}

function extractField(body, fieldName) {
  // Try different markdown heading formats
  const patterns = [
    new RegExp(`### ${fieldName}\\s*\\n\\s*([^#]*?)(?=\\n###|\\n$)`, 's'),
    new RegExp(`## ${fieldName}\\s*\\n\\s*([^#]*?)(?=\\n##|\\n$)`, 's'),
    new RegExp(`\\*\\*${fieldName}\\*\\*:?\\s*([^\\n]*?)\\n`, 'i'),
    new RegExp(`${fieldName}:?\\s*([^\\n]*?)\\n`, 'i')
  ];
  
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

async function createNewTask(task) {
  // In a real implementation, this would integrate with your task management system
  // For now, we'll log the task creation and optionally save to a file
  
  console.log('Creating new task:', JSON.stringify(task, null, 2));
  
  // Save task to a local file for demonstration
  // In production, this would be an API call to your task management system
  const tasksDir = path.join(process.cwd(), 'docs', 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }
  
  const taskFile = path.join(tasksDir, `${task.id}.json`);
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));
  
  console.log(`Task saved to ${taskFile}`);
}

async function updateExistingTask(taskId, updates) {
  // In a real implementation, this would update the task in your task management system
  console.log('Updating existing task:', taskId, JSON.stringify(updates, null, 2));
  
  // Update local task file for demonstration
  const taskFile = path.join(process.cwd(), 'docs', 'tasks', `${taskId}.json`);
  if (fs.existsSync(taskFile)) {
    const existingTask = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    const updatedTask = { ...existingTask, ...updates, updatedAt: new Date().toISOString() };
    fs.writeFileSync(taskFile, JSON.stringify(updatedTask, null, 2));
    console.log(`Task ${taskId} updated`);
  } else {
    console.log(`Task file not found: ${taskFile}`);
  }
}

async function addTaskIdToIssue(issueNumber, taskId) {
  // Add a comment to the issue with the task ID
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('No GITHUB_TOKEN available, skipping issue update');
    return;
  }
  
  const octokit = github.getOctokit(token);
  
  try {
    await octokit.rest.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber,
      body: `🤖 **Task Created**\n\nTask ID: \`${taskId}\`\n\nThis issue has been linked to internal task tracking.`
    });
    
    console.log(`Added task ID comment to issue #${issueNumber}`);
  } catch (error) {
    console.log(`Failed to add comment to issue: ${error.message}`);
  }
}

run();
