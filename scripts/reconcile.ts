import { checkReconciliation } from '../lib/reconcile';

const f = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

checkReconciliation().then((checks) => {
  for (const c of checks) {
    console.log(
      `${c.ok ? 'PASS' : 'FAIL'}  ${c.label.padEnd(26)} got ${f(c.got).padStart(16)}` +
        `  want ${f(c.want).padStart(16)}  diff ${(c.got - c.want).toFixed(2)}`,
    );
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(failed.length ? `\n${failed.length} CHECK(S) FAILED` : '\nall reconciliation checks pass');
  process.exit(failed.length ? 1 : 0);
});
