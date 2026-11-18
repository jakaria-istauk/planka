/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// How each AI assistant connects to the MCP server. `oauth` clients sign in through the consent
// screen and need no key; `apiKey` clients send the key in the `X-Api-Key` header from a config
// snippet. `steps` are locale keys; `buildSnippet` gets the server URL and the API key (or a
// placeholder when the key is not on screen).

const toJson = (value) => JSON.stringify(value, null, 2);

export const AuthTypes = {
  OAUTH: 'oauth',
  API_KEY: 'apiKey',
};

export default [
  {
    id: 'claude',
    name: 'Claude',
    descriptionKey: 'common.mcpClaudeDescription',
    icon: 'comment alternate outline',
    authType: AuthTypes.OAUTH,
    steps: [
      'common.mcpClaudeStep1',
      'common.mcpClaudeStep2',
      'common.mcpClaudeStep3',
      'common.mcpClaudeStep4',
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    descriptionKey: 'common.mcpChatgptDescription',
    icon: 'comments outline',
    authType: AuthTypes.OAUTH,
    steps: [
      'common.mcpChatgptStep1',
      'common.mcpChatgptStep2',
      'common.mcpChatgptStep3',
      'common.mcpChatgptStep4',
    ],
  },
  {
    id: 'claudeCode',
    name: 'Claude Code',
    descriptionKey: 'common.mcpClaudeCodeDescription',
    icon: 'terminal',
    authType: AuthTypes.API_KEY,
    language: 'shell',
    buildSnippet: (url, apiKey) =>
      `claude mcp add --transport http planka ${url} \\\n  --header "X-Api-Key: ${apiKey}"`,
  },
  {
    id: 'geminiCli',
    name: 'Gemini CLI',
    descriptionKey: 'common.mcpGeminiCliDescription',
    icon: 'star outline',
    authType: AuthTypes.API_KEY,
    fileName: '~/.gemini/settings.json',
    buildSnippet: (url, apiKey) =>
      toJson({
        mcpServers: {
          planka: {
            httpUrl: url,
            headers: {
              'X-Api-Key': apiKey,
            },
          },
        },
      }),
  },
  {
    id: 'codex',
    name: 'Codex',
    descriptionKey: 'common.mcpCodexDescription',
    icon: 'code',
    authType: AuthTypes.API_KEY,
    fileName: '~/.codex/config.toml',
    buildSnippet: (url, apiKey) =>
      `[mcp_servers.planka]\nurl = "${url}"\nhttp_headers = { "X-Api-Key" = "${apiKey}" }`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    descriptionKey: 'common.mcpCursorDescription',
    icon: 'i cursor',
    authType: AuthTypes.API_KEY,
    fileName: '~/.cursor/mcp.json',
    buildSnippet: (url, apiKey) =>
      toJson({
        mcpServers: {
          planka: {
            url,
            headers: {
              'X-Api-Key': apiKey,
            },
          },
        },
      }),
  },
  {
    id: 'vscode',
    name: 'VS Code',
    descriptionKey: 'common.mcpVscodeDescription',
    icon: 'file code outline',
    authType: AuthTypes.API_KEY,
    fileName: '.vscode/mcp.json',
    buildSnippet: (url, apiKey) =>
      toJson({
        servers: {
          planka: {
            type: 'http',
            url,
            headers: {
              'X-Api-Key': apiKey,
            },
          },
        },
      }),
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    descriptionKey: 'common.mcpWindsurfDescription',
    icon: 'paper plane outline',
    authType: AuthTypes.API_KEY,
    fileName: '~/.codeium/windsurf/mcp_config.json',
    buildSnippet: (url, apiKey) =>
      toJson({
        mcpServers: {
          planka: {
            serverUrl: url,
            headers: {
              'X-Api-Key': apiKey,
            },
          },
        },
      }),
  },
  {
    id: 'other',
    nameKey: 'common.otherMcpClient',
    descriptionKey: 'common.mcpOtherDescription',
    icon: 'plug',
    authType: AuthTypes.API_KEY,
    buildSnippet: (url, apiKey) => `URL: ${url}\nTransport: Streamable HTTP\nX-Api-Key: ${apiKey}`,
  },
];
