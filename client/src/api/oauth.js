/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import socket from './socket';

/* Actions */

const getOauthClient = (clientId, headers) =>
  socket.get(`/oauth/clients/${encodeURIComponent(clientId)}`, undefined, headers);

const createOauthConsent = (data, headers) => socket.post('/oauth/consents', data, headers);

const getOauthConnections = (headers) => socket.get('/oauth/connections', undefined, headers);

const deleteOauthConnection = (id, headers) =>
  socket.delete(`/oauth/connections/${id}`, undefined, headers);

export default {
  getOauthClient,
  createOauthConsent,
  getOauthConnections,
  deleteOauthConnection,
};
