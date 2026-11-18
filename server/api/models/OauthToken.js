/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * OauthToken.js
 *
 * @description :: OAuth 2.1 access and refresh token pair of one connected client. The access
 *                 token only works on the MCP endpoint; the refresh token rotates on every use.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    accessTokenHash: {
      type: 'string',
      required: true,
      columnName: 'access_token_hash',
    },
    refreshTokenHash: {
      type: 'string',
      required: true,
      columnName: 'refresh_token_hash',
    },
    scopes: {
      type: 'json',
      required: true,
    },
    resource: {
      type: 'string',
      allowNull: true,
    },
    accessTokenExpiresAt: {
      type: 'ref',
      required: true,
      columnName: 'access_token_expires_at',
    },
    refreshTokenExpiresAt: {
      type: 'ref',
      required: true,
      columnName: 'refresh_token_expires_at',
    },
    lastUsedAt: {
      type: 'ref',
      columnName: 'last_used_at',
    },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

    oauthClientId: {
      model: 'OauthClient',
      required: true,
      columnName: 'oauth_client_id',
    },
    userId: {
      model: 'User',
      required: true,
      columnName: 'user_id',
    },
  },

  tableName: 'oauth_token',
};
