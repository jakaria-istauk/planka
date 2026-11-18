/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /oauth/connections/{id}:
 *   delete:
 *     summary: Disconnect app
 *     description: Revokes every token the current user gave an OAuth client, so it can no longer reach the MCP server until the user approves it again. Requires a session access token.
 *     tags:
 *       - OAuth
 *     operationId: deleteOauthConnection
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the OAuth client record
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     responses:
 *       200:
 *         description: App disconnected
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
 *                     id:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  OAUTH_CONNECTION_NOT_FOUND: {
    oauthConnectionNotFound: 'OAuth connection not found',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    oauthConnectionNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const oauthTokens = await OauthToken.qm.delete({
      oauthClientId: inputs.id,
      userId: currentUser.id,
    });

    if (oauthTokens.length === 0) {
      throw Errors.OAUTH_CONNECTION_NOT_FOUND;
    }

    return {
      item: {
        id: inputs.id,
      },
    };
  },
};
