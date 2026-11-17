#!/usr/bin/env node

/*
 * Receives the signed deploy webhook from the Deploy workflow and runs
 * deploy.sh. Meant to sit behind a Cloudflare Tunnel, so it listens on
 * localhost only.
 *
 * Env: DEPLOY_WEBHOOK_SECRET (required), PORT (default 9000)
 */

const crypto = require('crypto');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const SECRET = process.env.DEPLOY_WEBHOOK_SECRET;
const PORT = parseInt(process.env.PORT, 10) || 9000;
const DEPLOY_SCRIPT = path.join(__dirname, 'deploy.sh');
const MAX_BODY_SIZE = 10 * 1024;

if (!SECRET) {
  console.error('DEPLOY_WEBHOOK_SECRET is not set');
  process.exit(1);
}

let isDeploying = false;
let pendingSha = null;

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

const isValidSignature = (body, header) => {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) {
    return false;
  }

  const expected = Buffer.from(
    `sha256=${crypto.createHmac('sha256', SECRET).update(body).digest('hex')}`,
  );
  const actual = Buffer.from(header);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const runDeploy = (sha) => {
  isDeploying = true;
  log(`Deploying ${sha}`);

  const child = spawn(DEPLOY_SCRIPT, [sha], { stdio: 'inherit' });

  child.on('close', (code) => {
    log(code === 0 ? `Deployed ${sha}` : `Deploy of ${sha} failed with code ${code}`);
    isDeploying = false;

    // A push that arrived mid-deploy is deployed right after, newest only
    if (pendingSha) {
      const nextSha = pendingSha;
      pendingSha = null;
      runDeploy(nextSha);
    }
  });
};

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404).end();
    return;
  }

  const chunks = [];
  let size = 0;

  req.on('data', (chunk) => {
    size += chunk.length;

    if (size > MAX_BODY_SIZE) {
      res.writeHead(413).end();
      req.destroy();
      return;
    }

    chunks.push(chunk);
  });

  req.on('end', () => {
    const body = Buffer.concat(chunks);

    if (!isValidSignature(body, req.headers['x-hub-signature-256'])) {
      log('Rejected request with invalid signature');
      res.writeHead(401).end('Invalid signature\n');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400).end('Invalid JSON\n');
      return;
    }

    if (payload.ref !== 'refs/heads/master' || !/^[0-9a-f]{40}$/.test(payload.sha)) {
      res.writeHead(400).end('Unexpected payload\n');
      return;
    }

    if (isDeploying) {
      pendingSha = payload.sha;
      res.writeHead(202).end('Queued\n');
      return;
    }

    runDeploy(payload.sha);
    res.writeHead(202).end('Deploy started\n');
  });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Listening on http://127.0.0.1:${PORT}/deploy`);
});
