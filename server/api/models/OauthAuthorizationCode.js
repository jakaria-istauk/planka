/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * OauthAuthorizationCode.js
 *
 * @description :: Short-lived OAuth 2.1 authorization code, issued when a user approves a client
 *                 on the consent screen and exchanged once for tokens.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    codeHash: {
      type: 'string',
      required: true,
      columnName: 'code_hash',
    },
    redirectUri: {
      type: 'string',
      required: true,
      columnName: 'redirect_uri',
    },
    codeChallenge: {
      type: 'string',
      required: true,
      columnName: 'code_challenge',
    },
    scopes: {
      type: 'json',
      required: true,
    },
    resource: {
      type: 'string',
      allowNull: true,
    },
    expiresAt: {
      type: 'ref',
      required: true,
      columnName: 'expires_at',
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

  tableName: 'oauth_authorization_code',
};
