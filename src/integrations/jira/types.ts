// -- Config types (split across config.json and credentials.json) --

export interface JiraProjectConfig {
  defaultProjectKey?: string;
  refreshIntervalMinutes?: number;
}

export interface JiraOAuthCredentials {
  authMethod: 'oauth';
  oauth: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    cloudId: string;
    siteUrl: string;
  };
}

export interface JiraApiTokenCredentials {
  authMethod: 'api-token';
  apiToken: {
    baseUrl: string;
    email: string;
    token: string;
  };
}

export type JiraCredentials = JiraOAuthCredentials | JiraApiTokenCredentials;

// -- Data types --

export interface JiraComment {
  author: string;
  body: string;
  created: string;
}

export interface JiraAttachment {
  filename: string;
  localPath: string;
  mimeType: string;
  size: number;
  contentUrl?: string;
  thumbnail?: string | null;
}

export interface JiraTaskData {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  created: string;
  updated: string;
  comments: JiraComment[];
  attachments: JiraAttachment[];
  linkedWorktree: string | null;
  fetchedAt: string;
  url: string;
}
