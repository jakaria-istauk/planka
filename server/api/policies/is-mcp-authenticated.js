/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { getProtectedResourceMetadataUrl } = require('../../utils/mcp/oauth-provider');

// MCP clients authenticate with an API key or an OAuth access token; the challenge points OAuth
// clients to the metadata they discover the authorization server from (RFC 9728)
module.exports = async function isMcpAuthenticated(req, res, proceed) {
  if (!req.currentUser || req.currentSession) {
    res.set('WWW-Authenticate', `Bearer resource_metadata="${getProtectedResourceMetadataUrl()}"`);

    return res.unauthorized('API key or OAuth access token is required');
  }

  if (req.currentUser.id === User.INTERNAL.id) {
    return res.notFound(); // Forbidden
  }

  return proceed();
};
