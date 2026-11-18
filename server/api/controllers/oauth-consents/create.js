/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /oauth/consents:
 *   post:
 *     summary: Answer OAuth consent
 *     description: Approves or denies an OAuth client asking to connect to the MCP server as the current user, and returns the URL to send the browser back to the client with. Approving issues a single-use authorization code. Requires a session access token.
 *     tags:
 *       - OAuth
 *     operationId: createOauthConsent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - redirectUri
 *               - codeChallenge
 *               - isApproved
 *             properties:
 *               clientId:
 *                 type: string
 *               redirectUri:
 *                 type: string
 *               codeChallenge:
 *                 type: string
 *                 description: PKCE S256 code challenge from the authorization request
 *               state:
 *                 type: string
 *               scope:
 *                 type: string
 *               resource:
 *                 type: string
 *                 description: Must be the MCP endpoint URL when present
 *               isApproved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Consent recorded
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
 *                     redirectUrl:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const {
  createAuthorizationCode,
  isResourceAllowed,
  redirectUriMatches,
} = require('../../../utils/mcp/oauth-provider');

const Errors = {
  OAUTH_CLIENT_NOT_FOUND: {
    oauthClientNotFound: 'OAuth client not found',
  },
  INVALID_REDIRECT_URI: {
    invalidRedirectUri: 'Redirect URI is not registered for this client',
  },
  INVALID_RESOURCE: {
    invalidResource: 'Resource must be the MCP endpoint',
  },
};

module.exports = {
  inputs: {
    clientId: {
      type: 'string',
      maxLength: 256,
      required: true,
    },
    redirectUri: {
      type: 'string',
      maxLength: 2048,
      required: true,
    },
    codeChallenge: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 256,
      required: true,
    },
    state: {
      type: 'string',
      maxLength: 2048,
    },
    scope: {
      type: 'string',
      maxLength: 1024,
    },
    resource: {
      type: 'string',
      maxLength: 2048,
    },
    isApproved: {
      type: 'boolean',
      required: true,
    },
  },

  exits: {
    oauthClientNotFound: {
      responseType: 'notFound',
    },
    invalidRedirectUri: {
      responseType: 'unprocessableEntity',
    },
    invalidResource: {
      responseType: 'unprocessableEntity',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const oauthClient = await OauthClient.qm.getOneByClientId(inputs.clientId);

    if (!oauthClient) {
      throw Errors.OAUTH_CLIENT_NOT_FOUND;
    }

    // The browser brings these parameters back from the authorize redirect, so they are checked
    // again: a code must only ever go to a redirect URI the client registered
    const isRedirectUriRegistered = oauthClient.redirectUris.some((redirectUri) =>
      redirectUriMatches(inputs.redirectUri, redirectUri),
    );

    if (!isRedirectUriRegistered) {
      throw Errors.INVALID_REDIRECT_URI;
    }

    if (!isResourceAllowed(inputs.resource)) {
      throw Errors.INVALID_RESOURCE;
    }

    const redirectUrl = new URL(inputs.redirectUri);

    if (inputs.isApproved) {
      const code = await createAuthorizationCode({
        oauthClient,
        user: currentUser,
        redirectUri: inputs.redirectUri,
        codeChallenge: inputs.codeChallenge,
        scopes: inputs.scope ? inputs.scope.split(' ').filter(Boolean) : [],
        resource: inputs.resource || null,
      });

      redirectUrl.searchParams.set('code', code);
    } else {
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User denied the request');
    }

    if (inputs.state) {
      redirectUrl.searchParams.set('state', inputs.state);
    }

    return {
      item: {
        redirectUrl: redirectUrl.href,
      },
    };
  },
};
