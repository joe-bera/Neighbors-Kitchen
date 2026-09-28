import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

// Supertest starts each app with listen(0), which binds every address, and then calls 127.0.0.1 on that
// port. When another program on this computer listens on 127.0.0.1, the system can give the test server
// that same port number, and the other program answers instead of the app: a rare, random test failure
// (seen on 2026-09-28 as a sign-up answered "401" with no body). Binding 127.0.0.1 itself rules that out,
// because the system never hands out a port that is already taken on that address.
// Loaded by tests/setup.ts for every test file.

type Callback = (error: unknown, response?: unknown) => void;

interface LoopbackState {
  /** Resolves to the port once the server is listening on 127.0.0.1. */
  listening: Promise<number>;
  /** Requests sent to this server that have not finished yet. */
  pending: number;
}

interface LoopbackTest {
  url: string;
  loopback?: { server: http.Server; state: LoopbackState; path: string };
}

const servers = new WeakMap<http.Server, LoopbackState>();

function listenOnLoopback(server: http.Server): LoopbackState {
  let state = servers.get(server);
  if (!state) {
    state = {
      pending: 0,
      listening: new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          server.removeListener('error', reject);
          resolve((server.address() as AddressInfo).port);
        });
      }),
    };
    servers.set(server, state);
  }
  return state;
}

const testPrototype = (request as unknown as { Test: { prototype: Record<string, unknown> } }).Test.prototype;
const originalServerAddress = testPrototype.serverAddress as (this: LoopbackTest, app: http.Server, path: string) => string;
const originalEnd = testPrototype.end as (this: LoopbackTest, callback?: Callback) => unknown;

testPrototype.serverAddress = function serverAddress(this: LoopbackTest, app: http.Server, path: string) {
  // A server the test started itself keeps its own address.
  if (app.address() && !servers.has(app)) return originalServerAddress.call(this, app, path);
  this.loopback = { server: app, state: listenOnLoopback(app), path };
  // The port is filled in when the request is sent (see end below).
  return `http://127.0.0.1${path}`;
};

testPrototype.end = function end(this: LoopbackTest, callback?: Callback) {
  const loopback = this.loopback;
  if (!loopback) return originalEnd.call(this, callback);
  const { server, state, path } = loopback;
  state.pending += 1;
  const finished = () => {
    state.pending -= 1;
    if (state.pending === 0) {
      servers.delete(server);
      server.close();
    }
  };
  state.listening.then(
    (port) => {
      this.url = `http://127.0.0.1:${port}${path}`;
      originalEnd.call(this, (error, response) => {
        finished();
        callback?.(error, response);
      });
    },
    (error: unknown) => {
      finished();
      callback?.(error);
    },
  );
  return this;
};
