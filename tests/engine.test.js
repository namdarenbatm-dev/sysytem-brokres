import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, calculateBundles, validateInputs } from '../engine.js';

test('default inputs create five valid, ordered packages', () => {
  const result = calculateBundles(DEFAULTS);
  assert.equal(result.valid, true);
  assert.equal(result.bundles.length, 5);
  assert.deepEqual(result.bundles.map((b) => b.cashCount), [1, 2, 3, 4, 5]);
  assert.ok(result.bundles.every((b) => b.valid));
});

test('marketing budget affects only pre-bundle POS price, not Cashless budget', () => {
  const a = calculateBundles({ ...DEFAULTS, posMarketing: 1 });
  const b = calculateBundles({ ...DEFAULTS, posMarketing: 4 });
  assert.equal(a.bundles[0].cashBudgetPerUnit, b.bundles[0].cashBudgetPerUnit);
  assert.equal(a.bundles[0].totalCashBudget, b.bundles[0].totalCashBudget);
  assert.equal(a.bundles[0].preBundlePrice + 3, b.bundles[0].preBundlePrice);
});

test('more cashless cannot increase the adjusted POS price', () => {
  const result = calculateBundles(DEFAULTS);
  for (let i = 1; i < result.bundles.length; i += 1) {
    assert.ok(result.bundles[i].adjustedPosPrice <= result.bundles[i - 1].adjustedPosPrice);
  }
});

test('adjusted POS price never falls below the competitive market floor', () => {
  const result = calculateBundles(DEFAULTS);
  assert.ok(result.bundles.every((b) => b.adjustedPosPrice >= DEFAULTS.marketFloor));
});

test('budget usage, remaining budget, and actual Cashless bundle price are consistent', () => {
  const result = calculateBundles(DEFAULTS);
  for (const b of result.bundles) {
    assert.ok(Math.abs((b.totalCashBudget - b.bundleBudgetUsed) - b.remainingBudget) < 0.0001);
    const expected = b.cashCost + b.cashMarkup + b.remainingBudget / b.cashCount;
    assert.ok(Math.abs(expected - b.actualCashPriceInBundle) < 0.0001);
    assert.ok(b.actualCashPriceInBundle <= b.cashSale + 0.0001);
  }
});

test('cashless count is capped by POS count', () => {
  const result = calculateBundles({ ...DEFAULTS, posCount: 2, maxCashCount: 5 });
  assert.equal(result.bundles.length, 2);
  assert.ok(result.bundles.every((b) => b.cashCount <= b.posCount));
});

test('negative Cashless capacity is rejected', () => {
  const result = calculateBundles({ ...DEFAULTS, cashSale: 26, cashMarkup: 2 });
  assert.equal(result.valid, false);
  assert.equal(result.bundles.length, 0);
});

test('competitive floor above pre-bundle price is rejected', () => {
  const inputs = { ...DEFAULTS, marketFloor: 25, posBase: 19, posMarketing: 1 };
  assert.equal(validateInputs(inputs).valid, false);
  assert.equal(calculateBundles(inputs).bundles.length, 0);
});

test('invalid integer counts are rejected', () => {
  const result = calculateBundles({ ...DEFAULTS, posCount: 2.5 });
  assert.equal(result.valid, false);
});


test('default package prices follow the frozen v4 example', () => {
  const result = calculateBundles(DEFAULTS);
  const oneCashless = result.bundles[0];
  const twoCashless = result.bundles[1];
  assert.equal(oneCashless.preBundlePrice, 20);
  assert.equal(oneCashless.adjustedPosPrice, 17);
  assert.equal(oneCashless.bundleBudgetUsed, 15);
  assert.equal(oneCashless.remainingBudget, 0);
  assert.equal(oneCashless.actualCashPriceInBundle, 27);
  assert.equal(twoCashless.adjustedPosPrice, 15);
  assert.equal(twoCashless.bundleBudgetUsed, 25);
  assert.equal(twoCashless.remainingBudget, 5);
  assert.equal(twoCashless.actualCashPriceInBundle, 29.5);
});

test('zero cashless budget is made explicit as a notice rather than fake subsidy', () => {
  const result = calculateBundles({ ...DEFAULTS, cashSale: 27, cashCost: 25, cashMarkup: 2 });
  assert.equal(result.valid, true);
  assert.ok(result.notices.some((notice) => notice.includes('ظرفیت اقتصادی هر کش‌لس صفر است')));
  assert.ok(result.bundles.every((b) => b.adjustedPosPrice === b.preBundlePrice));
});
