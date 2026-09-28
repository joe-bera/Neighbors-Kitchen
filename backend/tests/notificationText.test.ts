import { describe, expect, it } from 'vitest';
import { bellText } from '../src/services/notifications/bellText.js';
import { sampleOrder, sampleRequest, sampleReview } from './noticeFixtures.js';

describe('bellText', () => {
  it('shows order updates to the customer in the chef time zone, linking to the order', () => {
    expect(bellText('ORDER_CONFIRMED', sampleOrder)).toEqual({
      title: "Abuela's Table confirmed your order",
      body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM',
      link: '/orders/order-1',
    });
  });

  it("uses the chef's own time zone", () => {
    const newYorkKitchen = { ...sampleOrder, timezone: 'America/New_York' };
    expect(bellText('ORDER_CONFIRMED', newYorkKitchen)?.body).toBe('NK-7QX4PD · Tue, Sep 29 at 9:00 PM');
  });

  it('says ready for pickup, or on its way for delivery', () => {
    expect(bellText('ORDER_READY', sampleOrder)).toEqual({
      title: 'Your order is ready for pickup',
      body: "NK-7QX4PD from Abuela's Table",
      link: '/orders/order-1',
    });
    expect(bellText('ORDER_READY', { ...sampleOrder, pickupOrDelivery: 'DELIVERY' })?.title).toBe('Your order is on its way');
  });

  it('says declined for an order the chef never confirmed, cancelled otherwise, with the reason', () => {
    expect(bellText('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: true, reason: 'Out of masa today' })).toEqual({
      title: "Abuela's Table declined your order",
      body: 'Out of masa today',
      link: '/orders/order-1',
    });
    expect(bellText('ORDER_CANCELLED_BY_CHEF', { ...sampleOrder, declined: false })).toEqual({
      title: "Abuela's Table cancelled your order",
      body: 'NK-7QX4PD',
      link: '/orders/order-1',
    });
  });

  it('shortens a long reason to one bell line', () => {
    const reason = 'We ran out. '.repeat(25);
    const body = bellText('ORDER_CANCELLED_BY_CUSTOMER', { ...sampleOrder, reason })!.body!;
    expect(body).toHaveLength(120);
    expect(body.endsWith('…')).toBe(true);
  });

  it('tells the chef about a new order, with the confirm deadline when there is one', () => {
    expect(bellText('NEW_ORDER', sampleOrder)).toEqual({
      title: 'New order from Dana K.',
      body: 'NK-7QX4PD · Confirm by Tue, Sep 29 at 3:15 PM',
      link: '/chef/orders',
    });
    expect(bellText('NEW_ORDER', { ...sampleOrder, confirmBy: null })?.body).toBe('NK-7QX4PD · Tue, Sep 29 at 6:00 PM');
  });

  it('reminds the chef of the deadline', () => {
    expect(bellText('CONFIRM_REMINDER', sampleOrder)).toEqual({
      title: 'Order NK-7QX4PD still needs your confirmation',
      body: 'Confirm by Tue, Sep 29 at 3:15 PM or it will be cancelled automatically',
      link: '/chef/orders',
    });
  });

  it('words dish-request answers like the website does, linking to the requests', () => {
    expect(bellText('DISH_REQUEST_ANSWERED', sampleRequest)).toEqual({
      title: "Abuela's Table answered your dish request",
      body: 'Birria tacos: Chef is considering it',
      link: '/chefs/chef-1#requests-heading',
    });
    expect(bellText('DISH_REQUEST_ACCEPTED', { ...sampleRequest, status: 'ACCEPTED' })).toEqual({
      title: "Good news: Abuela's Table will make Birria tacos",
      body: 'You voted for this dish',
      link: '/chefs/chef-1#requests-heading',
    });
  });

  it('shows a review comment, shortened when long, or who wrote it', () => {
    expect(bellText('NEW_REVIEW', sampleReview)).toEqual({
      title: 'New 5-star review for Chicken Enchilada Casserole',
      body: "Tasted just like my tía's.",
      link: '/chef/feedback',
    });
    const long = bellText('NEW_REVIEW', { ...sampleReview, comment: 'So good! '.repeat(30) })!.body!;
    expect(long).toHaveLength(120);
    expect(long.endsWith('So…')).toBe(true);
    expect(bellText('NEW_REVIEW', { ...sampleReview, comment: null })?.body).toBe('From Dana K.');
  });

  it('has no bell text for receipts and password emails', () => {
    expect(bellText('ORDER_PLACED', sampleOrder)).toBeNull();
    expect(bellText('PASSWORD_RESET', { firstName: 'Dana', token: 'abc' })).toBeNull();
    expect(bellText('PASSWORD_CHANGED', { firstName: 'Dana' })).toBeNull();
  });
});
