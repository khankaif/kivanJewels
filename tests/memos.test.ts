import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRollback, makeFixtures } from './helpers';
import {
  issueOutwardMemo, returnFromMemo, billMemoLine, memoLineOutstanding,
  lotBalance, lotExposure, OverdrawError, SettlementError,
} from '@/lib/ledger/movements';

const lineOf = async (c: any, memoId: string): Promise<string> =>
  (await c.query(`SELECT id FROM memo_lines WHERE memo_id = $1`, [memoId])).rows[0].id;

test('issuing a memo removes carats from the vault and creates exposure', async () => {
  await inRollback(async (c) => {
    const { partyId, lotId } = await makeFixtures(c, 10);
    await issueOutwardMemo({
      memoNo: `ZZ-M1-${Date.now()}`, partyId, issuedOn: '2024-04-10',
      dueOn: '2024-04-17', lines: [{ lotId, carats: 4, rate: 4800 }],
    }, c);

    assert.equal(await lotBalance(lotId, c), 6, 'vault drops by the issued carats');
    assert.equal(await lotExposure(lotId, c), 4, 'issued carats show as exposure');
  });
});

test('issuing more than the vault holds is refused, and rolls back the whole memo', async () => {
  await inRollback(async (c) => {
    const { partyId, lotId } = await makeFixtures(c, 10);
    const memoNo = `ZZ-M2-${Date.now()}`;

    await assert.rejects(
      () => issueOutwardMemo({
        memoNo, partyId, issuedOn: '2024-04-10', dueOn: null,
        lines: [{ lotId, carats: 4, rate: 4800 }, { lotId, carats: 99, rate: 4800 }],
      }, c),
      OverdrawError,
    );
  });
});

test('a memo line settles across MANY partial events', async () => {
  await inRollback(async (c) => {
    const { partyId, lotId } = await makeFixtures(c, 10);
    const memoId = await issueOutwardMemo({
      memoNo: `ZZ-M3-${Date.now()}`, partyId, issuedOn: '2024-04-10',
      dueOn: '2024-04-17', lines: [{ lotId, carats: 4, rate: 4800 }],
    }, c);
    const line = await lineOf(c, memoId);

    assert.equal(await lotBalance(lotId, c), 6);

    // 1st event: client returns 1 ct
    await returnFromMemo({ memoLineId: line, carats: 1, on: '2024-04-12' }, c);
    assert.equal(await memoLineOutstanding(line, c), 3);
    assert.equal(await lotBalance(lotId, c), 7, 'returned carats re-enter the vault');

    // 2nd event: client buys 1 ct -- must NOT move carats again
    await billMemoLine({ memoLineId: line, carats: 1, on: '2024-04-15', invoiceNo: 'ZZ-INV-1' }, c);
    assert.equal(await memoLineOutstanding(line, c), 2);
    assert.equal(await lotBalance(lotId, c), 7, 'billing moves no carats: they left at issue');

    // 3rd event: client returns the remaining 2 ct
    await returnFromMemo({ memoLineId: line, carats: 2, on: '2024-04-20' }, c);
    assert.equal(await memoLineOutstanding(line, c), 0);
    assert.equal(await lotBalance(lotId, c), 9, '10 purchased - 1 billed = 9 in vault');
    assert.equal(await lotExposure(lotId, c), 0, 'nothing left with the client');
  });
});

test('settling more than outstanding is refused', async () => {
  await inRollback(async (c) => {
    const { partyId, lotId } = await makeFixtures(c, 10);
    const memoId = await issueOutwardMemo({
      memoNo: `ZZ-M4-${Date.now()}`, partyId, issuedOn: '2024-04-10',
      dueOn: null, lines: [{ lotId, carats: 4, rate: 4800 }],
    }, c);
    const line = await lineOf(c, memoId);

    await returnFromMemo({ memoLineId: line, carats: 4, on: '2024-04-12' }, c);
    await assert.rejects(
      () => returnFromMemo({ memoLineId: line, carats: 0.5, on: '2024-04-13' }, c),
      /exceeds outstanding/i,
    );
    await assert.rejects(
      () => billMemoLine({ memoLineId: line, carats: 0.5, on: '2024-04-13', invoiceNo: 'X' }, c),
      /exceeds outstanding/i,
    );
  });
});

test('line and memo close once fully settled', async () => {
  await inRollback(async (c) => {
    const { partyId, lotId } = await makeFixtures(c, 10);
    const memoNo = `ZZ-M5-${Date.now()}`;
    const memoId = await issueOutwardMemo({
      memoNo, partyId, issuedOn: '2024-04-10', dueOn: null,
      lines: [{ lotId, carats: 4, rate: 4800 }],
    }, c);
    const line = await lineOf(c, memoId);

    let { rows } = await c.query(
      `SELECT ml.status AS line, m.status AS memo FROM memo_lines ml
       JOIN memos m ON m.id = ml.memo_id WHERE ml.id = $1`, [line]);
    assert.equal(rows[0].line, 'open');
    assert.equal(rows[0].memo, 'open');

    await billMemoLine({ memoLineId: line, carats: 4, on: '2024-04-15', invoiceNo: 'ZZ-INV-2' }, c);

    ({ rows } = await c.query(
      `SELECT ml.status AS line, m.status AS memo FROM memo_lines ml
       JOIN memos m ON m.id = ml.memo_id WHERE ml.id = $1`, [line]));
    assert.equal(rows[0].line, 'settled');
    assert.equal(rows[0].memo, 'closed');
  });
});

test('billing posts a receivable to the money ledger', async () => {
  await inRollback(async (c) => {
    const { partyId, lotId } = await makeFixtures(c, 10);
    const invoiceNo = `ZZ-INV-${Date.now()}`;
    const memoId = await issueOutwardMemo({
      memoNo: `ZZ-M6-${Date.now()}`, partyId, issuedOn: '2024-04-10',
      dueOn: null, lines: [{ lotId, carats: 4, rate: 4800 }],
    }, c);
    const line = await lineOf(c, memoId);
    await billMemoLine({ memoLineId: line, carats: 2.5, on: '2024-04-15', invoiceNo }, c);

    const { rows } = await c.query(
      `SELECT kind, amount, party_id FROM ledger WHERE ref_id = $1`, [invoiceNo]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, 'sale_invoice');
    assert.equal(Number(rows[0].amount), 12000); // 2.5 ct x 4800
    assert.equal(rows[0].party_id, partyId);
  });
});

test('rejects zero/negative quantities and blank invoice numbers', async () => {
  await inRollback(async (c) => {
    const { partyId, lotId } = await makeFixtures(c, 10);
    const memoId = await issueOutwardMemo({
      memoNo: `ZZ-M7-${Date.now()}`, partyId, issuedOn: '2024-04-10',
      dueOn: null, lines: [{ lotId, carats: 4, rate: 4800 }],
    }, c);
    const line = await lineOf(c, memoId);

    await assert.rejects(() => returnFromMemo({ memoLineId: line, carats: 0, on: '2024-04-12' }, c), SettlementError);
    await assert.rejects(() => returnFromMemo({ memoLineId: line, carats: -1, on: '2024-04-12' }, c), SettlementError);
    await assert.rejects(
      () => billMemoLine({ memoLineId: line, carats: 1, on: '2024-04-12', invoiceNo: '  ' }, c),
      SettlementError);
  });
});
