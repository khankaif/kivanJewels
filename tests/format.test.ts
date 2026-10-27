import { test } from 'node:test';
import assert from 'node:assert/strict';
import { day, inr, money } from '../lib/format';

test('money reads in crore and lakh, whole rupees below a lakh', () => {
  assert.equal(money(19191251.91), '₹1.92 Cr');
  assert.equal(money(1378348.97), '₹13.78 L');
  assert.equal(money(53999.5), '₹54,000');
  assert.equal(money(-250000), '−₹2.50 L');
  assert.equal(money(null), '₹0');
});

test('day drops the year only for the current year', () => {
  const y = new Date().getUTCFullYear();
  assert.equal(day(`${y}-09-03`), '3 Sept');
  assert.equal(day('2024-01-15'), '15 Jan 2024');
  assert.equal(day(null), '—');
  assert.equal(day('not a date'), 'not a date');
});

test('inr puts the minus sign before the rupee symbol', () => {
  assert.equal(inr(-511584.76), '−₹5,11,584.76');
  assert.equal(inr(2200), '₹2,200.00');
});

test('waLink adds India to a bare mobile and encodes the message', async () => {
  const { waLink } = await import('../lib/whatsapp');
  assert.equal(waLink('Hi there', '98200 12345'), 'https://wa.me/919820012345?text=Hi%20there');
  assert.equal(waLink('x', '+1 415 555 0100'), 'https://wa.me/14155550100?text=x');
  assert.equal(waLink('x'), 'https://wa.me/?text=x');
});

test('parseSort honours only whitelisted columns and reads a leading minus as descending', async () => {
  const { parseSort, nextSort } = await import('../lib/sort');
  const cols = ['name', 'balance'] as const;
  const fb = { col: 'name' as const, dir: 'asc' as const };
  assert.deepEqual(parseSort('-balance', cols, fb), { col: 'balance', dir: 'desc' });
  assert.deepEqual(parseSort('balance', cols, fb), { col: 'balance', dir: 'asc' });
  assert.deepEqual(parseSort('drop table', cols, fb), fb);
  assert.equal(nextSort({ col: 'balance', dir: 'desc' }, 'balance', 'desc'), 'balance');
  assert.equal(nextSort({ col: 'balance', dir: 'desc' }, 'name', 'asc'), 'name');
});
