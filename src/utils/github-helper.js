/**
 * GitHub Helper utilities for creating issue links and displaying project information
 */

const GITHUB_REPO = 'rohit-purandare/shelfbridge';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;

/**
 * Create a GitHub issue URL with pre-filled content
 * @param {string} title - Issue title
 * @param {string} body - Issue body content
 * @param {string[]} labels - Array of labels to add
 * @returns {string} GitHub issue creation URL
 */
export function createIssueUrl(title, body, labels = []) {
  const params = new URLSearchParams();

  if (title) {
    params.append('title', title);
  }

  if (body) {
    params.append('body', body);
  }

  if (labels.length > 0) {
    params.append('labels', labels.join(','));
  }

  return `${GITHUB_ISSUES_URL}/new?${params.toString()}`;
}

/**
 * Collect comprehensive system and runtime information for error reporting
 * @param {Object} context - Additional context from the caller
 * @returns {Promise<Object>} Complete system information
 */
async function collectSystemInfo(context = {}) {
  const os = process.platform;
  const arch = process.arch;
  const nodeVersion = process.version;
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  // Environment detection
  let isDocker = false;
  try {
    // Check for Docker environment indicators
    isDocker =
      process.env.DOCKER_CONTAINER === 'true' ||
      process.env.KUBERNETES_SERVICE_HOST !== undefined;

    // Try to check for .dockerenv file (Docker container indicator)
    if (!isDocker) {
      const fs = await import('fs');
      isDocker = fs.existsSync('/.dockerenv');
    }
  } catch (_e) {
    // If we can't determine Docker status, assume native
    isDocker = false;
  }

  const environment = isDocker ? 'Docker' : 'Native';

  // Terminal/Shell information
  const terminal = {
    program: process.env.TERM_PROGRAM || 'Unknown',
    type: process.env.TERM || 'Unknown',
    shell: process.env.SHELL || 'Unknown',
    isTTY: process.stdout.isTTY,
  };

  // Runtime information
  const runtime = {
    cwd: process.cwd(),
    execPath: process.execPath,
    argv: process.argv.slice(2), // Remove node and script path
    env: {
      LOG_LEVEL: process.env.LOG_LEVEL,
      NODE_ENV: process.env.NODE_ENV,
      // Docker-specific env vars
      DOCKER_CONTAINER: process.env.DOCKER_CONTAINER,
      PUID: process.env.PUID,
      PGID: process.env.PGID,
      // ShelfBridge-specific env vars (without sensitive data)
      SHELFBRIDGE_CONFIG_EXISTS: process.env.SHELFBRIDGE_USER_0_ID
        ? 'true'
        : 'false',
    },
  };

  return {
    os,
    arch,
    nodeVersion,
    environment,
    terminal,
    runtime,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
    },
    uptime: Math.round(uptime) + 's',
    timestamp: new Date().toISOString(),
    ...context,
  };
}

/**
 * Create an error report issue URL
 * @param {Error} error - The error object
 * @param {Object} context - Additional context information
 * @returns {Promise<string>} GitHub issue URL for reporting the error
 */
export async function createErrorIssueUrl(error, context = {}) {
  const systemInfo = await collectSystemInfo(context);
  const title = `Bug Report: ${error.message || 'Unexpected Error'}`;

  // Format error details
  const errorDetails = `Error: ${error.message || 'Unknown error'}
${error.stack || 'No stack trace available'}`;

  // Format system environment
  const systemDetails = `**System Information**
- OS: ${systemInfo.os} (${systemInfo.arch})
- Node.js: ${systemInfo.nodeVersion}
- Environment: ${systemInfo.environment}
- ShelfBridge Version: ${systemInfo.version || 'Unknown'}
- Memory Usage: ${systemInfo.memory.heapUsed} / ${systemInfo.memory.heapTotal}
- Process Uptime: ${systemInfo.uptime}
- Timestamp: ${systemInfo.timestamp}

**Terminal Information**
- Terminal Program: ${systemInfo.terminal.program}
- Terminal Type: ${systemInfo.terminal.type}
- Shell: ${systemInfo.terminal.shell}
- Is TTY: ${systemInfo.terminal.isTTY}

**Runtime Context**
- Working Directory: ${systemInfo.runtime.cwd}
- Command Arguments: ${systemInfo.runtime.argv.join(' ') || 'None'}
- Log Level: ${systemInfo.runtime.env.LOG_LEVEL || 'Default'}
- Node Environment: ${systemInfo.runtime.env.NODE_ENV || 'Not set'}
- Docker Container: ${systemInfo.runtime.env.DOCKER_CONTAINER || 'false'}
- Config Method: ${systemInfo.runtime.env.SHELFBRIDGE_CONFIG_EXISTS === 'true' ? 'Environment Variables' : 'YAML File'}`;

  // Format operation context
  let operationContext = '';
  if (systemInfo.operation)
    operationContext += `- Operation: ${systemInfo.operation}\n`;
  if (systemInfo.command)
    operationContext += `- Command: ${systemInfo.command}\n`;
  if (systemInfo.user_id)
    operationContext += `- User ID: ${systemInfo.user_id}\n`;
  if (systemInfo.severity)
    operationContext += `- Severity: ${systemInfo.severity}\n`;
  if (systemInfo.component)
    operationContext += `- Component: ${systemInfo.component}\n`;

  const body = `## Bug Report

**Description**
An error occurred while using ShelfBridge. This issue was automatically generated with comprehensive system information.

**Error Details**
\`\`\`
${errorDetails}
\`\`\`

**Operation Context**
${operationContext || 'No specific operation context available'}

${systemDetails}

**Additional Information**
Please provide any additional details about:
1. What you were trying to accomplish when this error occurred
2. Steps to reproduce the issue
3. Any relevant configuration details
4. Whether this is a recurring issue or first occurrence

**Reproduction Steps**
1. [Please describe the steps to reproduce this error]
2. 
3. 

**Expected Behavior**
[What did you expect to happen?]

**Actual Behavior**
[What actually happened?]
`;

  return createIssueUrl(title, body, ['bug', 'needs-triage', 'auto-generated']);
}

/**
 * Create a general issue URL
 * @param {string} type - Type of issue (bug, feature, question)
 * @param {string} title - Issue title
 * @param {string} description - Issue description
 * @returns {string} GitHub issue URL
 */
export function createGeneralIssueUrl(
  type = 'bug',
  title = '',
  description = '',
) {
  const issueTitle =
    title || `${type.charAt(0).toUpperCase() + type.slice(1)} Report`;

  const body = `## ${type.charAt(0).toUpperCase() + type.slice(1)} Report

**Description**
${description || `Please describe your ${type} here.`}

**Environment**
- OS: ${process.platform}
- Node.js: ${process.version}
- ShelfBridge Version: Unknown

**Additional Information**
Please provide any additional relevant information.
`;

  const labels = [];
  switch (type) {
    case 'bug':
      labels.push('bug', 'needs-triage');
      break;
    case 'feature':
      labels.push('enhancement');
      break;
    case 'question':
      labels.push('question');
      break;
    default:
      labels.push('needs-triage');
  }

  return createIssueUrl(issueTitle, body, labels);
}

/**
 * Create a clickable hyperlink using ANSI escape codes (works in modern terminals)
 * @param {string} url - The URL to link to
 * @param {string} text - The display text for the link
 * @returns {string} ANSI hyperlink or plain text if hyperlinks not supported
 */
export function createClickableLink(url, text = url) {
  // Check if terminal supports hyperlinks (most modern terminals do)
  const supportsHyperlinks =
    process.stdout.isTTY &&
    (process.env.TERM_PROGRAM === 'vscode' ||
      process.env.TERM_PROGRAM === 'iTerm.app' ||
      process.env.TERM_PROGRAM === 'Apple_Terminal' ||
      process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm' ||
      (process.env.TERM && process.env.TERM.includes('xterm')));

  if (supportsHyperlinks) {
    // ANSI escape sequence for hyperlinks: \e]8;;URL\e\\TEXT\e]8;;\e\\
    return `\u001b]8;;${url}\u001b\\${text}\u001b]8;;\u001b\\`;
  }

  // Fallback: show both text and URL
  return text === url ? url : `${text}: ${url}`;
}

/**
 * Format error message with GitHub issue link
 * @param {string} errorMessage - The original error message
 * @param {Error} error - The error object
 * @param {Object} context - Additional context
 * @returns {Promise<string>} Formatted error message with issue link
 */
export async function formatErrorWithIssueLink(
  errorMessage,
  error,
  context = {},
) {
  const issueUrl = await createErrorIssueUrl(error, context);
  const clickableIssueLink = createClickableLink(
    issueUrl,
    'Create GitHub Issue',
  );
  const clickableDocsLink = createClickableLink(GITHUB_URL, 'Visit Repository');

  return `${errorMessage}

🐛 If this error persists, please report it:
   ${clickableIssueLink}

💡 For more help and documentation:
   ${clickableDocsLink}

📋 Manual link (copy/paste if needed):
   ${issueUrl}`;
}

/**
 * Get project information for display
 * @returns {Object} Project information
 */
export function getProjectInfo() {
  return {
    name: 'ShelfBridge',
    repository: GITHUB_URL,
    issues: GITHUB_ISSUES_URL,
    wiki: `${GITHUB_URL}/blob/main/wiki/Home.md`,
    discussions: `${GITHUB_URL}/discussions`,
    releases: `${GITHUB_URL}/releases`,
    changelog: `${GITHUB_URL}/blob/main/CHANGELOG.md`,
  };
}

/**
 * Format welcome message with project links
 * @param {string} version - Application version
 * @returns {string} Welcome message with project links
 */
export function formatWelcomeMessage(version) {
  const projectInfo = getProjectInfo();

  return `🌉 Welcome to ShelfBridge v${version}

📚 Sync your audiobook reading progress from Audiobookshelf to Hardcover

🔗 Project Links:
   • Repository: ${createClickableLink(projectInfo.repository, 'GitHub Repository')}
   • Documentation: ${createClickableLink(projectInfo.wiki, 'User Guide & Docs')}
   • Issues & Support: ${createClickableLink(projectInfo.issues, 'Get Help & Report Issues')}
   • Discussions: ${createClickableLink(projectInfo.discussions, 'Community Discussions')}
   • Latest Release: ${createClickableLink(projectInfo.releases, 'Download Latest Version')}
   • Changelog: ${createClickableLink(projectInfo.changelog, 'What\'s New & Release Notes')}

💡 Need help? Check the wiki or create an issue for support!
`;
}

/**
 * Format startup message for commands
 * @param {string} command - The command being executed
 * @param {string} version - Application version
 * @returns {string} Startup message
 */
export function formatStartupMessage(command, version) {
  const projectInfo = getProjectInfo();

  return `🌉 ShelfBridge v${version} - ${command}

💡 Need help? ${createClickableLink(projectInfo.wiki, 'Visit Docs')} or ${createClickableLink(projectInfo.issues, 'Get Support')}
`;
}

export default {
  createIssueUrl,
  createErrorIssueUrl,
  createGeneralIssueUrl,
  createClickableLink,
  formatErrorWithIssueLink,
  getProjectInfo,
  formatWelcomeMessage,
  formatStartupMessage,
  GITHUB_URL,
  GITHUB_ISSUES_URL,
};
