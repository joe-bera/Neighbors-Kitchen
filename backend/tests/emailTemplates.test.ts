import { describe, expect, it } from 'vitest';
import { renderEmail } from '../src/services/notifications/emailTemplates.js';
import { sampleOrder, sampleRequest, sampleReview } from './noticeFixtures.js';

describe('renderEmail', () => {
  it('links dish-request emails to the requests', () => {
    expect(renderEmail('NEW_DISH_REQUEST', sampleRequest).text).toContain('Answer the request: http://localhost:3000/chef/feedback?view=requests');
    expect(renderEmail('DISH_REQUEST_ACCEPTED', { ...sampleRequest, status: 'ACCEPTED' }).text).toContain(
      "See Abuela's Table: http://localhost:3000/chefs/chef-1#requests-heading",
    );
  });

  it('writes the receipt with the order details and a button to the order', () => {
    const email = renderEmail('ORDER_PLACED', sampleOrder);

    expect(email.subject).toBe("Your order NK-7QX4PD was sent to Abuela's Table");
    expect(email.html).toContain('Abuela&#39;s Table');
    expect(email.html).toContain('2 × Chicken Enchilada Casserole, 1 × Churros');
    expect(email.html).toContain('href="http://localhost:3000/orders/order-1"');
    expect(email.text).toContain('Pickup: Tue, Sep 29 at 6:00 PM');
    expect(email.text).toContain('Total: $33.00');
    expect(email.text).toContain('View your order: http://localhost:3000/orders/order-1');
  });

  it("tells the customer the chef's deadline when there is one", () => {
    expect(renderEmail('ORDER_PLACED', sampleOrder).text).toContain(
      "Abuela's Table will confirm it by Tue, Sep 29 at 3:15 PM. If it isn't confirmed by then, it's cancelled automatically and we'll tell you right away.",
    );
    expect(renderEmail('ORDER_PLACED', { ...sampleOrder, confirmBy: null }).text).toContain(
      "We'll email you as soon as Abuela's Table confirms it.",
    );
  });

  it('escapes everything people typed', () => {
    const email = renderEmail('ORDER_CANCELLED_BY_CHEF', {
      ...sampleOrder,
      kitchenName: '<b>Bold</b> & "Co"',
      reason: '<script>alert(1)</script>',
    });

    expect(email.html).toContain('&lt;b&gt;Bold&lt;/b&gt; &amp; &quot;Co&quot;');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<b>Bold');
  });

  it('says declined or cancelled, and shows the whole reason', () => {
    const reason = 'We ran out. '.repeat(25).trim();
    const declined = renderEmail('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: true, reason });
    expect(declined.subject).toBe("Abuela's Table declined your order NK-7QX4PD");
    expect(declined.text).toContain(`The chef's note: “${reason}”`);
    expect(renderEmail('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: false }).subject).toBe(
      "Abuela's Table cancelled your order NK-7QX4PD",
    );
  });

  it('shows the chef the payout, with the deadline in the subject', () => {
    const email = renderEmail('NEW_ORDER', sampleOrder);
    expect(email.subject).toBe('New order NK-7QX4PD: please confirm by Tue, Sep 29 at 3:15 PM');
    expect(email.text).toContain('Your payout: $29.70');
    expect(renderEmail('NEW_ORDER', { ...sampleOrder, confirmBy: null }).subject).toBe('New order NK-7QX4PD from Dana K.');
  });

  it('never shows customers the payout or a fee', () => {
    for (const kind of ['ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_READY', 'ORDER_EXPIRED', 'RATE_REMINDER'] as const) {
      const { text } = renderEmail(kind, sampleOrder);
      expect(text).not.toContain('29.70');
      expect(text.toLowerCase()).not.toContain('fee');
    }
  });

  it('adds the turn-off link only to emails people can switch off', () => {
    expect(renderEmail('RATE_REMINDER', sampleOrder).html).toContain('href="http://localhost:3000/account#email-settings"');
    expect(renderEmail('NEW_REVIEW', sampleReview).text).toContain(
      'Turn these emails off in your account settings: http://localhost:3000/account#email-settings',
    );
    expect(renderEmail('DISH_REQUEST_ANSWERED', sampleRequest).html).toContain('account#email-settings');
    expect(renderEmail('ORDER_CONFIRMED', sampleOrder).html).not.toContain('account#email-settings');
    expect(renderEmail('PASSWORD_RESET', { firstName: 'Dana', token: 'abc' }).html).not.toContain('account#email-settings');
  });

  it('puts the reset token in the link, with the reassurance in the footer', () => {
    const email = renderEmail('PASSWORD_RESET', { firstName: 'Dana', token: 'abc-DEF_123' });
    expect(email.text).toContain('Hi Dana,');
    expect(email.text).toContain('Choose a new password: http://localhost:3000/reset-password#token=abc-DEF_123');
    expect(email.text).toContain("If you didn't ask for this, you can ignore this email. Your password stays the same.");
    expect(email.text).not.toContain("You're getting this email because");
  });

  it('refuses kinds that have no email, and data it cannot use', () => {
    expect(() => renderEmail('ORDER_PREPARING', sampleOrder)).toThrow('There is no email for ORDER_PREPARING');
    expect(() => renderEmail('ORDER_CONFIRMED', {})).toThrow();
  });
});
