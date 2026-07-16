import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { HardcoverClient } from '../src/hardcover-client.js';

describe('Hardcover authentication errors', () => {
  let client;

  afterEach(() => {
    client?.cleanup();
  });

  it('explains how to resolve an HTTP 401 without exposing the token', async () => {
    const token = 'secret-hardcover-token';
    client = new HardcoverClient(token);
    client.client.post = async () => ({
      status: 401,
      statusText: 'Unauthorized',
      data: {},
    });

    await assert.rejects(client._executeQuery('query { me { id } }'), error => {
      assert.equal(error.name, 'HardcoverAuthenticationError');
      assert.equal(error.code, 'HARDCOVER_AUTHENTICATION_FAILED');
      assert.equal(error.statusCode, 401);
      assert.match(error.message, /Hardcover authentication failed/);
      assert.match(error.message, /Hardcover API token/);
      assert.match(error.message, /hardcover_token/);
      assert.match(error.message, /SHELFBRIDGE_USER_<N>_HARDCOVER_TOKEN/);
      assert.match(error.message, /hardcover\.app\/account\/developer/);
      assert.doesNotMatch(error.message, new RegExp(token));
      return true;
    });
  });

  it('retains the generic GraphQL error for other HTTP failures', async () => {
    client = new HardcoverClient('secret-hardcover-token');
    client.client.post = async () => ({
      status: 403,
      statusText: 'Forbidden',
      data: {},
    });

    await assert.rejects(
      client._executeQuery('query { me { id } }'),
      /GraphQL API request failed with status 403: Forbidden/,
    );
  });
});
