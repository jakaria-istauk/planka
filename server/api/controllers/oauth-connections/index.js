/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /oauth/connections:
 *   get:
 *     summary: Get connected apps
 *     description: Retrieves the OAuth clients the current user has connected to the MCP server, one item per client. Requires a session access token.
 *     tags:
 *       - OAuth
 *     operationId: getOauthConnections
 *     responses:
 *       200:
 *         description: Connected apps retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - items
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID of the OAuth client record
 *                       name:
 *                         type: string
 *                         nullable: true
 *                       clientUri:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastUsedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

module.exports = {
  async fn() {
    const { currentUser } = this.req;

    const oauthTokens = await OauthToken.qm.getByUserId(currentUser.id);
    const oauthTokensByClientId = _.groupBy(oauthTokens, 'oauthClientId');

    const oauthClients = await OauthClient.qm.getByIds(Object.keys(oauthTokensByClientId));

    const items = oauthClients.map((oauthClient) => {
      const clientTokens = oauthTokensByClientId[oauthClient.id];
      const lastUsedAts = _.compact(_.map(clientTokens, 'lastUsedAt'));

      return {
        id: oauthClient.id,
        name: oauthClient.name,
        clientUri: oauthClient.metadata.client_uri || null,
        createdAt: _.min(_.map(clientTokens, 'createdAt')),
        lastUsedAt: lastUsedAts.length > 0 ? _.max(lastUsedAts) : null,
      };
    });

    return {
      items: _.orderBy(items, ['createdAt'], ['desc']),
    };
  },
};
