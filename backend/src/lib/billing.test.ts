import assert from 'node:assert/strict';
import { adjustToBusinessDay, deriveBillingMonth, getEffectiveClosingDate } from './billing';

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: 'adjustToBusinessDay uses next Monday for Saturday when policy is NEXT_BUSINESS_DAY',
    run: () => {
      const saturday = new Date(Date.UTC(2025, 10, 8));
      const monday = adjustToBusinessDay(saturday, 'NEXT_BUSINESS_DAY');
      assert.equal(monday.getUTCDate(), 10);
    },
  },
  {
    name: 'adjustToBusinessDay uses previous Friday for Sunday when policy is PREVIOUS_BUSINESS_DAY',
    run: () => {
      const sunday = new Date(Date.UTC(2025, 10, 9));
      const friday = adjustToBusinessDay(sunday, 'PREVIOUS_BUSINESS_DAY');
      assert.equal(friday.getUTCDate(), 7);
    },
  },
  {
    name: 'getEffectiveClosingDate rolls weekend closing to next business day',
    run: () => {
      const date = getEffectiveClosingDate(2025, 11, 9, 'NEXT_BUSINESS_DAY');
      assert.equal(date.getUTCDate(), 10);
    },
  },
  {
    name: 'deriveBillingMonth keeps transactions before closing within same month',
    run: () => {
      const tx = new Date(Date.UTC(2025, 10, 3));
      const billing = deriveBillingMonth(tx, 9, 'NEXT_BUSINESS_DAY');
      assert.equal(billing, '2025-11');
    },
  },
  {
    name: 'deriveBillingMonth rolls to next month after closing cutoff',
    run: () => {
      const tx = new Date(Date.UTC(2025, 10, 15));
      const billing = deriveBillingMonth(tx, 9, 'NEXT_BUSINESS_DAY');
      assert.equal(billing, '2025-12');
    },
  },
  {
    name: 'deriveBillingMonth handles December rollover',
    run: () => {
      const tx = new Date(Date.UTC(2025, 11, 31));
      const billing = deriveBillingMonth(tx, 15, 'NEXT_BUSINESS_DAY');
      assert.equal(billing, '2026-01');
    },
  },
];

let failures = 0;
for (const test of tests) {
  try {
    test.run();
    console.log(`✓ ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${test.name}`);
    console.error(error);
  }
}

if (failures) {
  process.exit(1);
}
