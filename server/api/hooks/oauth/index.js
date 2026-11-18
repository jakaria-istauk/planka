/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * oauth hook
 *
 * @description :: OAuth 2.1 authorization server for the MCP endpoint, so clients that only
 *                 connect through OAuth (ChatGPT, Claude connectors) can sign in as a Tama user.
 *                 Serves discovery metadata, dynamic client registration, the authorize redirect,
 *                 the token and revoke endpoints through the handlers of the MCP SDK.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

/* eslint-disable import/no-unresolved, import/extensions */
const {
  authorizationHandler,
} = require('@modelcontextprotocol/sdk/server/auth/handlers/authorize.js');
const { metadataHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/metadata.js');
const {
  clientRegistrationHandler,
} = require('@modelcontextprotocol/sdk/server/auth/handlers/register.js');
const { revocationHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/revoke.js');
const { tokenHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/token.js');
/* eslint-enable import/no-unresolved, import/extensions */

const {
  provider,
  getAuthorizationServerMetadata,
  getProtectedResourceMetadata,
  verifyClientSecret,
} = require('../../../utils/mcp/oauth-provider');

// Express rate limit warns about proxy headers it cannot trust; Tama's `TRUST_PROXY` decides that
const RATE_LIMIT_OPTIONS = {
  validate: false,
};

module.exports = function defineOauthHook(sails) {
  let handlerByPath;

  // Runs an SDK handler as if it were mounted at the matched path
  const runHandler = (handler, req, res, next) => {
    const { url } = req;
    const queryIndex = url.indexOf('?');

    req.url = queryIndex === -1 ? '/' : `/${url.substring(queryIndex)}`;

    handler(req, res, (error) => {
      req.url = url;
      next(error);
    });
  };

  // The SDK compares client secrets in plain text, but only their hashes are stored
  const checkClientSecret = async (req, res, next) => {
    const { client_id: clientId, client_secret: clientSecret } = req.body || {};

    if (clientId) {
      const oauthClient = await OauthClient.qm.getOneByClientId(clientId);

      if (oauthClient && !verifyClientSecret(oauthClient, clientSecret)) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client_secret',
        });
      }
    }

    return next();
  };

  const buildRoute = (path, withClientSecretCheck = false) => ({
    skipAssets: false,
    async fn(req, res, next) {
      const handler = handlerByPath[path];

      if (withClientSecretCheck) {
        return checkClientSecret(req, res, () => runHandler(handler, req, res, next));
      }

      return runHandler(handler, req, res, next);
    },
  });

  return {
    /**
     * Runs when this Sails app loads/lifts.
     */

    async initialize() {
      sails.log.info('Initializing custom hook (`oauth`)');

      const protectedResourceMetadataHandler = metadataHandler(getProtectedResourceMetadata());

      handlerByPath = {
        '/.well-known/oauth-authorization-server': metadataHandler(
          getAuthorizationServerMetadata(),
        ),
        '/.well-known/oauth-protected-resource': protectedResourceMetadataHandler,
        '/.well-known/oauth-protected-resource/api/mcp': protectedResourceMetadataHandler,
        '/oauth/authorize': authorizationHandler({
          provider,
          rateLimit: RATE_LIMIT_OPTIONS,
        }),
        '/oauth/token': tokenHandler({
          provider,
          rateLimit: RATE_LIMIT_OPTIONS,
        }),
        '/oauth/register': clientRegistrationHandler({
          clientsStore: provider.clientsStore,
          clientSecretExpirySeconds: 0,
          rateLimit: RATE_LIMIT_OPTIONS,
        }),
        '/oauth/revoke': revocationHandler({
          provider,
          rateLimit: RATE_LIMIT_OPTIONS,
        }),
      };
    },

    routes: {
      before: {
        '/.well-known/oauth-authorization-server': buildRoute(
          '/.well-known/oauth-authorization-server',
        ),
        '/.well-known/oauth-protected-resource': buildRoute(
          '/.well-known/oauth-protected-resource',
        ),
        '/.well-known/oauth-protected-resource/api/mcp': buildRoute(
          '/.well-known/oauth-protected-resource/api/mcp',
        ),
        '/oauth/authorize': buildRoute('/oauth/authorize'),
        '/oauth/token': buildRoute('/oauth/token', true),
        '/oauth/register': buildRoute('/oauth/register'),
        '/oauth/revoke': buildRoute('/oauth/revoke', true),
      },
    },
  };
};
