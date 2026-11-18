/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * OAuth 2.1 authorization server provider for the MCP endpoint, plugged into the handlers of
 * `@modelcontextprotocol/sdk`. Clients register themselves (dynamic client registration), the
 * user approves them on the consent screen of the web app, and the issued access tokens only
 * work on `/api/mcp`. Only hashes of secrets, codes and tokens are stored.
 */

const crypto = require('crypto');

/* eslint-disable import/no-unresolved, import/extensions */
const {
  InvalidGrantError,
  InvalidTargetError,
  InvalidTokenError,
} = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const {
  redirectUriMatches,
} = require('@modelcontextprotocol/sdk/server/auth/handlers/authorize.js');
/* eslint-enable import/no-unresolved, import/extensions */

const ACCESS_TOKEN_PREFIX = 'plk_oat_';
const REFRESH_TOKEN_PREFIX = 'plk_ort_';

const AUTHORIZATION_CODE_LIFETIME = 10 * 60; // 10 minutes
const ACCESS_TOKEN_LIFETIME = 60 * 60; // 1 hour
const REFRESH_TOKEN_LIFETIME = 30 * 24 * 60 * 60; // 30 days

const SCOPES = ['mcp'];

const generateSecret = (prefix = '') => `${prefix}${crypto.randomBytes(32).toString('base64url')}`;

const hash = (value) => sails.helpers.utils.hash(value);

const getExpiresAt = (lifetime) => new Date(Date.now() + lifetime * 1000).toISOString();

const getIssuerUrl = () => sails.config.custom.baseUrl;

const getMcpUrl = () => `${sails.config.custom.baseUrl}/api/mcp`;

const isAccessToken = (token) => token.startsWith(ACCESS_TOKEN_PREFIX);

// The client secret stays out of the returned client: the SDK compares it in plain text, while
// only its hash is stored. `verifyClientSecret` checks it before the token and revoke handlers run
const presentClient = (oauthClient) => ({
  ...oauthClient.metadata,
  client_id: oauthClient.clientId,
  redirect_uris: oauthClient.redirectUris,
});

const verifyClientSecret = (oauthClient, clientSecret) =>
  !oauthClient.clientSecretHash || oauthClient.clientSecretHash === hash(clientSecret || '');

// Clients send the resource they want a token for; it can only be this server's MCP endpoint
const assertResource = (resource) => {
  if (resource && resource.href !== getMcpUrl()) {
    throw new InvalidTargetError(`Resource must be ${getMcpUrl()}`);
  }
};

const isResourceAllowed = (resource) => !resource || resource === getMcpUrl();

const issueTokens = async (values) => {
  const accessToken = generateSecret(ACCESS_TOKEN_PREFIX);
  const refreshToken = generateSecret(REFRESH_TOKEN_PREFIX);

  const tokenValues = {
    accessTokenHash: hash(accessToken),
    refreshTokenHash: hash(refreshToken),
    accessTokenExpiresAt: getExpiresAt(ACCESS_TOKEN_LIFETIME),
    refreshTokenExpiresAt: getExpiresAt(REFRESH_TOKEN_LIFETIME),
  };

  if (values.id) {
    await OauthToken.qm.updateOne(values.id, tokenValues);
  } else {
    await OauthToken.qm.createOne({
      ...values,
      ...tokenValues,
    });
  }

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_LIFETIME,
    refresh_token: refreshToken,
    scope: values.scopes.join(' '),
  };
};

const createAuthorizationCode = async ({
  oauthClient,
  user,
  redirectUri,
  codeChallenge,
  scopes,
  resource,
}) => {
  const code = generateSecret();

  await OauthAuthorizationCode.qm.createOne({
    redirectUri,
    codeChallenge,
    scopes,
    resource,
    codeHash: hash(code),
    expiresAt: getExpiresAt(AUTHORIZATION_CODE_LIFETIME),
    oauthClientId: oauthClient.id,
    userId: user.id,
  });

  return code;
};

const getOauthClientRecord = async (client) => {
  const oauthClient = await OauthClient.qm.getOneByClientId(client.client_id);

  if (!oauthClient) {
    throw new InvalidGrantError('Unknown client');
  }

  return oauthClient;
};

const clientsStore = {
  async getClient(clientId) {
    const oauthClient = await OauthClient.qm.getOneByClientId(clientId);
    return oauthClient ? presentClient(oauthClient) : undefined;
  },

  async registerClient(client) {
    await OauthClient.qm.createOne({
      clientId: client.client_id,
      clientSecretHash: client.client_secret ? hash(client.client_secret) : null,
      name: client.client_name || null,
      redirectUris: client.redirect_uris,
      metadata: _.omit(client, ['client_id', 'client_secret', 'redirect_uris']),
    });

    return client;
  },
};

const provider = {
  clientsStore,

  // The SDK has checked the client, redirect URI and PKCE parameters; the user decides on the
  // consent screen of the web app, which asks the server for the code (`oauth/create-consent`)
  async authorize(client, params, res) {
    assertResource(params.resource);

    const query = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
    });

    if (params.state) {
      query.set('state', params.state);
    }

    if (params.scopes && params.scopes.length > 0) {
      query.set('scope', params.scopes.join(' '));
    }

    if (params.resource) {
      query.set('resource', params.resource.href);
    }

    res.redirect(`${sails.config.custom.baseUrl}/oauth/consent?${query}`);
  },

  async challengeForAuthorizationCode(client, code) {
    const oauthClient = await getOauthClientRecord(client);
    const authorizationCode = await OauthAuthorizationCode.qm.getOneUnexpiredByCodeHash(hash(code));

    if (!authorizationCode || authorizationCode.oauthClientId !== oauthClient.id) {
      throw new InvalidGrantError('Invalid authorization code');
    }

    return authorizationCode.codeChallenge;
  },

  async exchangeAuthorizationCode(client, code, codeVerifier, redirectUri, resource) {
    const oauthClient = await getOauthClientRecord(client);
    const authorizationCode = await OauthAuthorizationCode.qm.deleteOneByCodeHash(hash(code));

    if (
      !authorizationCode ||
      authorizationCode.oauthClientId !== oauthClient.id ||
      new Date(authorizationCode.expiresAt) <= new Date()
    ) {
      throw new InvalidGrantError('Invalid authorization code');
    }

    if (redirectUri && redirectUri !== authorizationCode.redirectUri) {
      throw new InvalidGrantError('Redirect URI does not match the authorization request');
    }

    assertResource(resource);

    return issueTokens({
      scopes: authorizationCode.scopes,
      resource: authorizationCode.resource,
      oauthClientId: oauthClient.id,
      userId: authorizationCode.userId,
    });
  },

  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const oauthClient = await getOauthClientRecord(client);
    const oauthToken = await OauthToken.qm.getOneUnexpiredByRefreshTokenHash(hash(refreshToken));

    if (!oauthToken || oauthToken.oauthClientId !== oauthClient.id) {
      throw new InvalidGrantError('Invalid refresh token');
    }

    assertResource(resource);

    // Refresh tokens rotate: the old pair stops working once the new one is issued
    return issueTokens({
      id: oauthToken.id,
      scopes: oauthToken.scopes,
    });
  },

  async verifyAccessToken(token) {
    const oauthToken = await OauthToken.qm.getOneUnexpiredByAccessTokenHash(hash(token));

    if (!oauthToken) {
      throw new InvalidTokenError('Invalid access token');
    }

    const oauthClient = await OauthClient.qm.getByIds([oauthToken.oauthClientId]);

    return {
      token,
      clientId: oauthClient[0] ? oauthClient[0].clientId : '',
      scopes: oauthToken.scopes,
      expiresAt: Math.floor(new Date(oauthToken.accessTokenExpiresAt).getTime() / 1000),
      resource: oauthToken.resource ? new URL(oauthToken.resource) : undefined,
    };
  },

  async revokeToken(client, request) {
    const oauthClient = await getOauthClientRecord(client);
    const tokenHash = hash(request.token);

    await OauthToken.qm.delete({
      oauthClientId: oauthClient.id,
      or: [{ accessTokenHash: tokenHash }, { refreshTokenHash: tokenHash }],
    });
  },
};

const getAuthorizationServerMetadata = () => {
  const issuerUrl = getIssuerUrl();

  return {
    issuer: issuerUrl,
    authorization_endpoint: `${issuerUrl}/oauth/authorize`,
    token_endpoint: `${issuerUrl}/oauth/token`,
    registration_endpoint: `${issuerUrl}/oauth/register`,
    revocation_endpoint: `${issuerUrl}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: SCOPES,
  };
};

const getProtectedResourceMetadata = () => ({
  resource: getMcpUrl(),
  authorization_servers: [getIssuerUrl()],
  scopes_supported: SCOPES,
  bearer_methods_supported: ['header'],
  resource_name: 'PLANKA',
});

const getProtectedResourceMetadataUrl = () =>
  `${sails.config.custom.baseUrl}/.well-known/oauth-protected-resource/api/mcp`;

module.exports = {
  provider,
  createAuthorizationCode,
  getAuthorizationServerMetadata,
  getMcpUrl,
  getProtectedResourceMetadata,
  getProtectedResourceMetadataUrl,
  isAccessToken,
  isResourceAllowed,
  presentClient,
  redirectUriMatches,
  verifyClientSecret,
  hash,
};
