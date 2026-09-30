import { describe, expect, it, vi } from 'vitest';
import { mailboxTransport, OutgoingEmail, resendTransport, transportFromEnv } from '../src/services/notifications/mailer.js';

const email: OutgoingEmail = {
  id: 'email-1',
  to: 'dana@nk-sample.com',
  from: 'Neighbors Kitchen <no-reply@neighborskitchen.app>',
  subject: 'Your order NK-7QX4PD was sent',
  html: '<p>Hi</p>',
  text: 'Hi',
};

const answering = (status: number, body: string, statusText = '') =>
  vi.fn<typeof fetch>(async () => new Response(body, { status, statusText, headers: { 'Content-Type': 'application/json' } }));

describe('resendTransport', () => {
  it('posts the email to Resend, with our id as the idempotency key', async () => {
    const fetchImpl = answering(200, JSON.stringify({ id: 'resend-1' }));

    await resendTransport('re_test_123', { fetchImpl }).send(email);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer re_test_123',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'email-1',
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      from: 'Neighbors Kitchen <no-reply@neighborskitchen.app>',
      to: 'dana@nk-sample.com',
      subject: 'Your order NK-7QX4PD was sent',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('reports a refusal without any address in it', async () => {
    const fetchImpl = answering(422, JSON.stringify({ statusCode: 422, name: 'validation_error', message: 'Invalid `to` field: dana@nk-sample.com' }));

    await expect(resendTransport('re_test_123', { fetchImpl }).send(email)).rejects.toThrow(
      'Resend 422: validation_error: Invalid `to` field: (address)',
    );
  });

  it('reports an answer that is not JSON by its status', async () => {
    const fetchImpl = answering(502, '<html>oops</html>', 'Bad Gateway');

    await expect(resendTransport('re_test_123', { fetchImpl }).send(email)).rejects.toThrow('Resend 502: Bad Gateway');
  });

  it('gives up on a send that takes too long', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    await expect(resendTransport('re_test_123', { fetchImpl, timeoutMs: 20 }).send(email)).rejects.toThrow(
      'The operation was aborted due to timeout',
    );
  });

  it('is a real service: sent password links are not kept', () => {
    expect(resendTransport('re_test_123').keepsCopies).toBe(false);
  });
});

describe('transportFromEnv', () => {
  it('uses the setting', () => {
    expect(transportFromEnv({ EMAIL_TRANSPORT: 'mailbox', RESEND_API_KEY: undefined })).toBe(mailboxTransport);
    expect(transportFromEnv({ EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_test_123' }).keepsCopies).toBe(false);
  });
});
