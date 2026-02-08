import { execFileSync } from 'child_process';
import { select, input, password } from '@inquirer/prompts';

import { APP_NAME, CONFIG_DIR_NAME } from '../constants';
import { checkGhAuth, checkGhInstalled, getRepoInfo } from '../integrations/github/gh-client';
import { log } from '../logger';
import {
  loadJiraCredentials,
  saveJiraCredentials,
  saveJiraProjectConfig,
} from '../integrations/jira/credentials';
import {
  runOAuthFlow,
  discoverCloudId,
  testConnection,
} from '../integrations/jira/auth';
import type { JiraCredentials } from '../integrations/jira/types';
import { findConfigDir } from './config';

interface Integration {
  name: string;
  description: string;
  getStatus: (configDir: string) => string;
  setup: () => Promise<void>;
}

const INTEGRATIONS: Integration[] = [
  {
    name: 'github',
    description: 'GitHub (PRs, commit & push)',
    getStatus: () => {
      try {
        execFileSync('which', ['gh'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return 'ready (gh installed)';
      } catch {
        return 'gh not installed';
      }
    },
    setup: runConnectGitHub,
  },
  {
    name: 'jira',
    description: 'Atlassian Jira (issue tracking)',
    getStatus: (configDir) => loadJiraCredentials(configDir) ? 'connected' : 'not configured',
    setup: runConnectJira,
  },
];

export async function runConnect() {
  const configDir = findConfigDir();
  if (!configDir) {
    log.error(`No config found. Run "${APP_NAME} init" first.`);
    process.exit(1);
  }

  // If integration name passed directly, skip the picker
  const integration = process.argv[3];
  if (integration) {
    const match = INTEGRATIONS.find((i) => i.name === integration);
    if (!match) {
      log.error(`Unknown integration: ${integration}`);
      console.log(`Available: ${INTEGRATIONS.map((i) => i.name).join(', ')}`);
      process.exit(1);
    }
    await match.setup();
    return;
  }

  const items = INTEGRATIONS.map((i) => ({
    ...i,
    status: i.getStatus(configDir),
  }));

  const chosen = await select({
    message: 'Select integration to set up',
    choices: items.map((item) => {
      const marker = item.status === 'connected' ? '✓' : '○';
      return {
        name: `${marker} ${item.name} — ${item.description} (${item.status})`,
        value: item.name,
      };
    }),
  });

  const match = items.find((i) => i.name === chosen)!;
  await match.setup();
}

async function runConnectGitHub() {
  log.info('GitHub Integration\n');

  const installed = await checkGhInstalled();
  if (!installed) {
    console.log('  The GitHub CLI (gh) is not installed.\n');
    console.log('  Install it:');
    console.log('    macOS:   brew install gh');
    console.log('    Linux:   https://github.com/cli/cli/blob/trunk/docs/install_linux.md');
    console.log('    Windows: winget install --id GitHub.cli\n');
    console.log('  Then run: gh auth login');
    return;
  }

  console.log('  ✓ gh CLI installed');

  const authenticated = await checkGhAuth();
  if (!authenticated) {
    console.log('  ✗ Not authenticated\n');
    console.log('  Run: gh auth login');
    return;
  }

  console.log('  ✓ Authenticated');

  try {
    const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const repo = await getRepoInfo(gitRoot);
    if (repo) {
      console.log(`  ✓ Repository: ${repo.owner}/${repo.repo} (default branch: ${repo.defaultBranch})`);
    } else {
      console.log('  ✗ Could not detect repository. Make sure this is a GitHub repo.');
      return;
    }
  } catch {
    console.log('  ✗ Not inside a git repository.');
    return;
  }

  log.success('\nGitHub is ready! PR detection, commit, and push will work automatically.');
}

async function runConnectJira() {
  const configDir = findConfigDir();
  if (!configDir) {
    log.error(`No config found. Run "${APP_NAME} init" first.`);
    process.exit(1);
  }

  log.info('Connect to Jira\n');

  const authMethod = await select({
    message: 'Authentication method',
    choices: [
      {
        name: 'OAuth 2.0 (recommended)',
        value: 'oauth' as const,
        description: 'Requires creating an OAuth app at developer.atlassian.com',
      },
      {
        name: 'API Token',
        value: 'api-token' as const,
        description: 'Simpler setup, no app registration needed',
      },
    ],
  });

  let creds: JiraCredentials;

  if (authMethod === 'api-token') {
    log.info('\nAPI Token setup');
    console.log('Create a token at: https://id.atlassian.com/manage-profile/security/api-tokens\n');

    const baseUrl = (await input({
      message: 'Jira site URL',
      required: true,
      validate: (v) => v.trim() ? true : 'URL is required.',
    })).replace(/\/$/, '');

    const email = await input({
      message: 'Email',
      required: true,
      validate: (v) => v.trim() ? true : 'Email is required.',
    });

    const token = await password({
      message: 'API Token',
      validate: (v) => v.trim() ? true : 'Token is required.',
    });

    creds = {
      authMethod: 'api-token',
      apiToken: { baseUrl, email, token },
    };
  } else {
    log.info('\nOAuth 2.0 setup');
    console.log('Create an OAuth app at: https://developer.atlassian.com/console\n');

    const clientId = await input({
      message: 'Client ID',
      required: true,
      validate: (v) => v.trim() ? true : 'Client ID is required.',
    });

    const clientSecret = await password({
      message: 'Client Secret',
      validate: (v) => v.trim() ? true : 'Client Secret is required.',
    });

    log.info('Starting OAuth flow...');

    const tokens = await runOAuthFlow(clientId, clientSecret);
    const { cloudId, siteUrl } = await discoverCloudId(tokens.accessToken);

    creds = {
      authMethod: 'oauth',
      oauth: {
        clientId,
        clientSecret,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
        cloudId,
        siteUrl,
      },
    };
  }

  const defaultProjectKey = await input({
    message: 'Project key (e.g. PROJ, optional)',
  });

  saveJiraCredentials(configDir, creds);

  if (defaultProjectKey) {
    saveJiraProjectConfig(configDir, { defaultProjectKey: defaultProjectKey.toUpperCase() });
  }

  // Test connection
  log.info('\nTesting connection...');
  try {
    const user = await testConnection(creds, configDir);
    log.success(`Connected as: ${user}`);
  } catch (err) {
    log.error(`Connection test failed: ${err}`);
    process.exit(1);
  }

  log.success('\nJira connected successfully!');
  log.info(`Credentials saved to ${CONFIG_DIR_NAME}/integrations.json (make sure it's gitignored)`);
}
