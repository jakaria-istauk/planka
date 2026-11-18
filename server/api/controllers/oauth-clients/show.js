/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /oauth/clients/{clientId}:
 *   get:
 *     summary: Get OAuth client
 *     description: Retrieves the public details of an OAuth client that asks to connect to the MCP server, for the consent screen. Requires a session access token.
 *     tags:
 *       - OAuth
 *     operationId: getOauthClient
 *     parameters:
 *       - name: clientId
 *         in: path
 *         required: true
 *         description: OAuth client ID issued at registration
 *         schema:
 *           type: string
 *           example: 6c1f0e7a-4f0e-4a43-9c38-0e1b1a6f9a10
 *     responses:
 *       200:
 *         description: OAuth client retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - item
 *               properties:
 *                 item:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     name:
 *                       type: string
 *                       nullable: true
 *                     clientUri:
 *                       type: string
 *                       nullable: true
 *                     redirectUris:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

const Errors = {
  OAUTH_CLIENT_NOT_FOUND: {
    oauthClientNotFound: 'OAuth client not found',
  },
};

module.exports = {
  inputs: {
    clientId: {
      type: 'string',
      maxLength: 256,
      required: true,
    },
  },

  exits: {
    oauthClientNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const oauthClient = await OauthClient.qm.getOneByClientId(inputs.clientId);

    if (!oauthClient) {
      throw Errors.OAUTH_CLIENT_NOT_FOUND;
    }

    return {
      item: {
        clientId: oauthClient.clientId,
        name: oauthClient.name,
        clientUri: oauthClient.metadata.client_uri || null,
        redirectUris: oauthClient.redirectUris,
      },
    };
  },
};
