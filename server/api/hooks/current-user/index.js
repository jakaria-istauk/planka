/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * current-user hook
 *
 * @description :: A hook definition. Extends Sails by adding shadow routes, implicit actions,
 *                 and/or initialization logic.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

const { isAccessToken: isOauthAccessToken } = require('../../../utils/mcp/oauth-provider');

module.exports = function defineCurrentUserHook(sails) {
  const TOKEN_PATTERN = /^Bearer /;
  const API_KEY_HEADER_NAME = 'x-api-key';

  // OAuth access tokens are issued to MCP clients and do not open the rest of the API
  const OAUTH_ACCESS_TOKEN_PATHS = new Set(['/api/mcp']);

  // The five checks a token has to pass live in `utils/resolveAccessToken`,
  // shared with the routes that serve avatars and background images so the two
  // cannot answer differently.
  const getSessionAndUserByAccessToken = (accessToken, httpOnlyToken) =>
    sails.helpers.utils.resolveAccessToken.with({
      accessToken,
      httpOnlyToken: httpOnlyToken || null,
    });

  const getUserByApiKey = (apiKey) => {
    const apiKeyHash = sails.helpers.utils.hash(apiKey);

    return User.qm.getOneActiveByApiKeyHash(apiKeyHash);
  };

  const getOauthTokenAndUserByAccessToken = async (accessToken) => {
    const oauthToken = await OauthToken.qm.getOneUnexpiredByAccessTokenHash(
      sails.helpers.utils.hash(accessToken),
    );

    if (!oauthToken) {
      return null;
    }

    const user = await User.qm.getOneById(oauthToken.userId, {
      withDeactivated: false,
    });

    if (!user) {
      return null;
    }

    await OauthToken.qm.updateOne(oauthToken.id, {
      lastUsedAt: new Date().toISOString(),
    });

    return {
      oauthToken,
      user,
    };
  };

  return {
    /**
     * Runs when this Sails app loads/lifts.
     */

    async initialize() {
      sails.log.info('Initializing custom hook (`current-user`)');
    },

    routes: {
      before: {
        '/api/*': {
          async fn(req, res, next) {
            const { authorization: authorizationHeader, [API_KEY_HEADER_NAME]: apiKey } =
              req.headers;

            if (authorizationHeader && TOKEN_PATTERN.test(authorizationHeader)) {
              const accessToken = authorizationHeader.replace(TOKEN_PATTERN, '');
              const { internalAccessToken } = sails.config.custom;

              if (internalAccessToken && accessToken === internalAccessToken) {
                req.currentUser = User.INTERNAL;
              } else if (isOauthAccessToken(accessToken)) {
                if (OAUTH_ACCESS_TOKEN_PATHS.has(req.path)) {
                  const oauthTokenAndUser = await getOauthTokenAndUserByAccessToken(accessToken);

                  if (oauthTokenAndUser) {
                    const { oauthToken, user } = oauthTokenAndUser;

                    if (user.language) {
                      req.setLocale(user.language);
                    }

                    Object.assign(req, {
                      currentOauthToken: oauthToken,
                      currentUser: user,
                    });
                  }
                }
              } else {
                const { httpOnlyToken } = req.cookies;

                const sessionAndUser = await getSessionAndUserByAccessToken(
                  accessToken,
                  httpOnlyToken,
                );

                if (sessionAndUser) {
                  const { session, user } = sessionAndUser;

                  if (user.language) {
                    req.setLocale(user.language);
                  }

                  Object.assign(req, {
                    currentSession: session,
                    currentUser: user,
                  });

                  if (req.isSocket) {
                    sails.sockets.join(req, `@accessToken:${session.accessToken}`);
                    sails.sockets.join(req, `@user:${user.id}`);
                  }
                }
              }
            } else if (apiKey) {
              const user = await getUserByApiKey(apiKey);

              if (user) {
                if (user.language) {
                  req.setLocale(user.language);
                }

                req.currentUser = user;

                if (req.isSocket) {
                  sails.sockets.join(req, `@user:${user.id}`);
                }
              }
            }

            return next();
          },
        },
        '/attachments/*': {
          async fn(req, res, next) {
            const { accessToken, httpOnlyToken } = req.cookies;

            if (accessToken) {
              const sessionAndUser = await getSessionAndUserByAccessToken(
                accessToken,
                httpOnlyToken,
              );

              if (sessionAndUser) {
                const { session, user } = sessionAndUser;

                Object.assign(req, {
                  currentSession: session,
                  currentUser: user,
                });
              }
            } else {
              const { [API_KEY_HEADER_NAME]: apiKey } = req.headers;

              if (apiKey) {
                const user = await getUserByApiKey(apiKey);

                if (user) {
                  req.currentUser = user;
                }
              }
            }

            return next();
          },
        },
      },
    },
  };
};
