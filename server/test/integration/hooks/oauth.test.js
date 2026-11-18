/*
 * Requires a PostgreSQL datastore: see test/integration/controllers/mcp/handle.test.js.
 */

const crypto = require('crypto');
const { expect } = require('chai');
const request = require('supertest');

describe('oauth (hook)', () => {
  const suffix = Date.now().toString(36);
  const createdUserIds = [];
  const createdSessionIds = [];
  const redirectUri = 'https://client.example.com/callback';
  let counter = 0;

  let app;
  let user;
  let accessToken;
  let apiKey;

  const createUser = async (values = {}) => {
    counter += 1;

    const created = await User.qm.createOne({
      email: `oauth-${suffix}-${counter}@test.test`,
      role: User.Roles.BOARD_USER,
      name: `OAuth ${counter}`,
      ...values,
    });

    createdUserIds.push(created.id);
    return created;
  };

  const createSessionToken = async (forUser) => {
    const { token } = sails.helpers.utils.createJwtToken(forUser.id);

    const session = await Session.qm.createOne({
      accessToken: token,
      userId: forUser.id,
      remoteAddress: '127.0.0.1',
    });

    createdSessionIds.push(session.id);
    return token;
  };

  const createPkce = () => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    return { verifier, challenge };
  };

  const registerClient = (values = {}) =>
    request(app)
      .post('/oauth/register')
      .send({
        client_name: `Client ${suffix}`,
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        ...values,
      });

  const approve = (clientId, pkce, values = {}) =>
    request(app)
      .post('/api/oauth/consents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        clientId,
        redirectUri,
        codeChallenge: pkce.challenge,
        state: 'xyz',
        isApproved: true,
        ...values,
      });

  const getCode = async (clientId, pkce) => {
    const response = await approve(clientId, pkce);

    expect(response.status).to.equal(200);
    return new URL(response.body.item.redirectUrl).searchParams.get('code');
  };

  const exchangeCode = (values) =>
    request(app)
      .post('/oauth/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        ...values,
      });

  const connect = async (clientValues = {}) => {
    const { body: client } = await registerClient(clientValues);
    const pkce = createPkce();
    const code = await getCode(client.client_id, pkce);

    const response = await exchangeCode({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      code_verifier: pkce.verifier,
    });

    expect(response.status).to.equal(200);
    return { client, tokens: response.body };
  };

  const listMcpTools = (token) =>
    request(app)
      .post('/api/mcp')
      .set({
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      })
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

  before(async () => {
    app = sails.hooks.http.app;
    user = await createUser();
    accessToken = await createSessionToken(user);

    const { key, prefix } = sails.helpers.utils.generateApiKey();
    apiKey = key;

    await User.qm.updateOne(user.id, {
      apiKeyPrefix: prefix,
      apiKeyHash: sails.helpers.utils.hash(key),
    });
  });

  after(async () => {
    if (createdUserIds.length > 0) {
      await OauthToken.destroy({ userId: createdUserIds });
      await OauthAuthorizationCode.destroy({ userId: createdUserIds });
      await Session.destroy({ id: createdSessionIds });
      await User.destroy({ id: createdUserIds });
    }

    await OauthClient.destroy({ name: { startsWith: `Client ${suffix}` } });
  });

  describe('discovery', () => {
    it('serves authorization server metadata', async () => {
      const response = await request(app).get('/.well-known/oauth-authorization-server');
      const { baseUrl } = sails.config.custom;

      expect(response.status).to.equal(200);
      expect(response.body).to.include({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
      });
      expect(response.body.code_challenge_methods_supported).to.deep.equal(['S256']);
    });

    it('serves protected resource metadata for the MCP endpoint', async () => {
      const response = await request(app).get('/.well-known/oauth-protected-resource/api/mcp');
      const { baseUrl } = sails.config.custom;

      expect(response.status).to.equal(200);
      expect(response.body.resource).to.equal(`${baseUrl}/api/mcp`);
      expect(response.body.authorization_servers).to.deep.equal([baseUrl]);
    });

    it('points unauthenticated MCP requests to the resource metadata', async () => {
      const response = await listMcpTools('nope');

      expect(response.status).to.equal(401);
      expect(response.headers['www-authenticate']).to.equal(
        `Bearer resource_metadata="${sails.config.custom.baseUrl}/.well-known/oauth-protected-resource/api/mcp"`,
      );
    });
  });

  describe('authorization code flow', () => {
    it('registers a client and redirects authorization to the consent screen', async () => {
      const { status, body: client } = await registerClient();

      expect(status).to.equal(201);
      expect(client.client_id).to.be.a('string');
      expect(client).not.to.have.property('client_secret');

      const pkce = createPkce();

      const response = await request(app).get('/oauth/authorize').query({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
        state: 'xyz',
        scope: 'mcp',
      });

      expect(response.status).to.equal(302);

      const location = new URL(response.headers.location);

      expect(location.pathname).to.equal(`${sails.config.custom.baseUrlPath}/oauth/consent`);
      expect(location.searchParams.get('client_id')).to.equal(client.client_id);
      expect(location.searchParams.get('code_challenge')).to.equal(pkce.challenge);
      expect(location.searchParams.get('state')).to.equal('xyz');
    });

    it('shows the client to a session user', async () => {
      const { body: client } = await registerClient();

      const response = await request(app)
        .get(`/api/oauth/clients/${client.client_id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.item.name).to.equal(`Client ${suffix}`);
    });

    it('issues tokens that open only the MCP endpoint', async () => {
      const { tokens } = await connect();

      expect(tokens.token_type).to.equal('bearer');
      expect(tokens.refresh_token).to.be.a('string');

      const mcpResponse = await listMcpTools(tokens.access_token);

      expect(mcpResponse.status).to.equal(200);
      expect(mcpResponse.body.result.tools).to.have.length.greaterThan(0);

      const restResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${tokens.access_token}`);

      expect(restResponse.status).to.equal(401);
    });

    it('rejects a reused authorization code', async () => {
      const { body: client } = await registerClient();
      const pkce = createPkce();
      const code = await getCode(client.client_id, pkce);

      const values = {
        code,
        client_id: client.client_id,
        code_verifier: pkce.verifier,
      };

      expect((await exchangeCode(values)).status).to.equal(200);
      expect((await exchangeCode(values)).status).to.equal(400);
    });

    it('rejects a wrong PKCE verifier', async () => {
      const { body: client } = await registerClient();
      const pkce = createPkce();
      const code = await getCode(client.client_id, pkce);

      const response = await exchangeCode({
        code,
        client_id: client.client_id,
        code_verifier: createPkce().verifier,
      });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.equal('invalid_grant');
    });

    it('rotates refresh tokens', async () => {
      const { client, tokens } = await connect();

      const refresh = (refreshToken) =>
        request(app).post('/oauth/token').type('form').send({
          grant_type: 'refresh_token',
          client_id: client.client_id,
          refresh_token: refreshToken,
        });

      const response = await refresh(tokens.refresh_token);

      expect(response.status).to.equal(200);
      expect(response.body.access_token).not.to.equal(tokens.access_token);
      expect((await refresh(tokens.refresh_token)).status).to.equal(400);
      expect((await listMcpTools(tokens.access_token)).status).to.equal(401);
      expect((await listMcpTools(response.body.access_token)).status).to.equal(200);
    });

    it('checks the secret of confidential clients', async () => {
      const { body: client } = await registerClient({
        token_endpoint_auth_method: 'client_secret_post',
      });

      expect(client.client_secret).to.be.a('string');

      const pkce = createPkce();
      const code = await getCode(client.client_id, pkce);

      const wrongSecretResponse = await exchangeCode({
        code,
        client_id: client.client_id,
        client_secret: 'wrong',
        code_verifier: pkce.verifier,
      });

      expect(wrongSecretResponse.status).to.equal(401);

      const response = await exchangeCode({
        code,
        client_id: client.client_id,
        client_secret: client.client_secret,
        code_verifier: pkce.verifier,
      });

      expect(response.status).to.equal(200);
    });

    it('revokes tokens through the revoke endpoint', async () => {
      const { client, tokens } = await connect();

      const response = await request(app).post('/oauth/revoke').type('form').send({
        client_id: client.client_id,
        token: tokens.refresh_token,
      });

      expect(response.status).to.equal(200);
      expect((await listMcpTools(tokens.access_token)).status).to.equal(401);
    });
  });

  describe('consent', () => {
    it('redirects with access_denied when the user denies', async () => {
      const { body: client } = await registerClient();
      const response = await approve(client.client_id, createPkce(), { isApproved: false });

      const location = new URL(response.body.item.redirectUrl);

      expect(location.searchParams.get('error')).to.equal('access_denied');
      expect(location.searchParams.get('state')).to.equal('xyz');
      expect(location.searchParams.has('code')).to.equal(false);
    });

    it('rejects a redirect URI the client did not register', async () => {
      const { body: client } = await registerClient();

      const response = await approve(client.client_id, createPkce(), {
        redirectUri: 'https://attacker.example.com/callback',
      });

      expect(response.status).to.equal(422);
    });

    it('rejects a resource other than the MCP endpoint', async () => {
      const { body: client } = await registerClient();

      const response = await approve(client.client_id, createPkce(), {
        resource: 'https://other.example.com/mcp',
      });

      expect(response.status).to.equal(422);
    });

    it('requires a browser session, not an API key', async () => {
      const { body: client } = await registerClient();

      const response = await request(app)
        .post('/api/oauth/consents')
        .set('X-Api-Key', apiKey)
        .send({
          clientId: client.client_id,
          redirectUri,
          codeChallenge: createPkce().challenge,
          isApproved: true,
        });

      expect(response.status).to.equal(404);
    });
  });

  describe('connected apps', () => {
    it('lists connected apps and disconnects one', async () => {
      const { client, tokens } = await connect();

      const listResponse = await request(app)
        .get('/api/oauth/connections')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(listResponse.status).to.equal(200);

      const connection = listResponse.body.items.find(({ name }) => name === client.client_name);

      expect(connection).to.include.keys('id', 'createdAt', 'lastUsedAt');

      const deleteResponse = await request(app)
        .delete(`/api/oauth/connections/${connection.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteResponse.status).to.equal(200);
      expect((await listMcpTools(tokens.access_token)).status).to.equal(401);
    });

    it('does not disconnect apps of other users', async () => {
      const { tokens } = await connect();
      const otherUser = await createUser();
      const otherAccessToken = await createSessionToken(otherUser);

      const [oauthToken] = await OauthToken.qm.getByUserId(user.id);

      const response = await request(app)
        .delete(`/api/oauth/connections/${oauthToken.oauthClientId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`);

      expect(response.status).to.equal(404);
      expect((await listMcpTools(tokens.access_token)).status).to.equal(200);
    });
  });

  describe('self-service API keys', () => {
    it('lets a user create and delete their own API key', async () => {
      const createResponse = await request(app)
        .post(`/api/users/${user.id}/api-key`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(createResponse.status).to.equal(200);
      expect(createResponse.body.included.apiKey).to.be.a('string');

      const deleteResponse = await request(app)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ apiKey: null });

      expect(deleteResponse.status).to.equal(200);
      expect(deleteResponse.body.item.apiKeyPrefix).to.equal(null);
    });

    it('does not let a user create an API key for someone else', async () => {
      const otherUser = await createUser();

      const response = await request(app)
        .post(`/api/users/${otherUser.id}/api-key`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).to.equal(404);
    });
  });
});
