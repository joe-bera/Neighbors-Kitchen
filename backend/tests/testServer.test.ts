import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Guards the test setup (tests/loopbackServer.ts), not the app.
describe('Test requests', () => {
  it('reach an app served from 127.0.0.1 itself, so no other program on this computer can answer them', async () => {
    const app = express();
    app.get('/where', (req, res) => {
      res.json({ localAddress: req.socket.localAddress });
    });

    const res = await request(app).get('/where');

    expect(res.body).toEqual({ localAddress: '127.0.0.1' });
  });
});
