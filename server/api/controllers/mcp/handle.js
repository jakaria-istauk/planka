/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /mcp:
 *   post:
 *     summary: MCP endpoint
 *     description: |
 *       Model Context Protocol server over stateless streamable HTTP. Accepts JSON-RPC messages
 *       (`initialize`, `tools/list`, `tools/call`) and answers with JSON. Tools run as the API key
 *       user, with the same permission checks as the matching REST endpoints. Requires an API key;
 *       session access tokens are rejected. GET and DELETE answer 405.
 *
 *       Add it to Claude Code with:
 *       `claude mcp add --transport http planka https://planka.example.com/api/mcp --header "X-Api-Key: <key>"`
 *     tags:
 *       - MCP
 *     operationId: handleMcp
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: Accept
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *           example: application/json, text/event-stream
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: JSON-RPC 2.0 request
 *             required:
 *               - jsonrpc
 *               - method
 *             properties:
 *               jsonrpc:
 *                 type: string
 *                 example: "2.0"
 *               id:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                 example: 1
 *               method:
 *                 type: string
 *                 example: tools/call
 *               params:
 *                 type: object
 *                 example:
 *                   name: list_cards
 *                   arguments:
 *                     boardId: "1357158568008091264"
 *     responses:
 *       200:
 *         description: JSON-RPC response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       405:
 *         description: Method not allowed (GET, DELETE)
 *       406:
 *         description: Accept header does not allow both application/json and text/event-stream
 */

// The SDK resolves these through its `exports` map, which the import plugin cannot read
/* eslint-disable import/no-unresolved, import/extensions */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
  StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
/* eslint-enable import/no-unresolved, import/extensions */

const version = require('../../../version');
const tools = require('../../../utils/mcp/tools');
const { ActionError } = require('../../../utils/mcp/run-action');

const buildTextResult = (text, isError = false) => ({
  isError,
  content: [
    {
      text,
      type: 'text',
    },
  ],
});

const buildServer = (req) => {
  const server = new McpServer({
    version,
    name: 'planka',
  });

  tools.forEach((tool) => {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (inputs) => {
        try {
          const result = await tool.handler(inputs, req);
          return buildTextResult(JSON.stringify(result));
        } catch (error) {
          if (error instanceof ActionError) {
            return buildTextResult(error.message, true);
          }

          sails.log.error(`MCP tool ${tool.name} failed with error: ${error}`);
          return buildTextResult('Internal server error', true);
        }
      },
    );
  });

  return server;
};

// Stateless streamable HTTP: every request gets its own server and transport, bound to the
// API key user of that request. Without sessions there is no stream to open with GET or to
// close with DELETE, so both are answered with 405 as the spec allows.
module.exports = async function handle(req, res) {
  if (req.method !== 'POST') {
    return res
      .set('Allow', 'POST')
      .status(405)
      .json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed',
        },
        id: null,
      });
  }

  const server = buildServer(req);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    sails.log.error(`MCP request failed with error: ${error}`);

    if (!res.headersSent) {
      return res.serverError();
    }
  }

  return undefined;
};
