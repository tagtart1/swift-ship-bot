'use strict';

const { spawn } = require('node:child_process');

const port = process.env.PORT ?? '3000';
const subdomain = 'swift-ship-dev';
const expectedUrl = `https://${subdomain}.loca.lt`;
const startupTimeoutMs = 15_000;

const localtunnel = spawn(
  'npx',
  ['--yes', 'localtunnel@2.0.2', '--port', port, '--subdomain', subdomain],
  { stdio: ['inherit', 'pipe', 'inherit'] },
);

let output = '';
let validatedUrl = false;
let failureMessage;

function fail(message) {
  if (failureMessage) return;

  failureMessage = message;
  console.error(message);
  localtunnel.kill('SIGTERM');
}

const startupTimeout = setTimeout(() => {
  fail(
    `LocalTunnel did not provide ${expectedUrl} within ${startupTimeoutMs / 1000} seconds`,
  );
}, startupTimeoutMs);

localtunnel.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  output += text;

  const match = output.match(/your url is:\s*(https:\/\/\S+)/i);
  if (!match || validatedUrl || failureMessage) return;

  const assignedUrl = match[1];
  if (assignedUrl !== expectedUrl) {
    fail(
      `Expected LocalTunnel URL ${expectedUrl}, but received ${assignedUrl}`,
    );
    return;
  }

  validatedUrl = true;
  clearTimeout(startupTimeout);
});

localtunnel.on('error', (error) => {
  fail(`Could not start LocalTunnel: ${error.message}`);
});

localtunnel.on('close', (code) => {
  clearTimeout(startupTimeout);

  if (failureMessage) {
    process.exitCode = 1;
    return;
  }

  if (!validatedUrl) {
    console.error(`LocalTunnel exited without providing ${expectedUrl}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});

process.once('SIGINT', () => localtunnel.kill('SIGINT'));
process.once('SIGTERM', () => localtunnel.kill('SIGTERM'));
