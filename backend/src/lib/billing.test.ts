/**
 * billing.test.ts
 * Testes unitários para funções de cálculo de billingMonth
 * 
 * Execute: npm run test:billing
 */

import assert from 'node:assert/strict';
import { adjustToBusinessDay, deriveBillingMonth, getEffectiveClosingDate } from './billing';

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: 'adjustToBusinessDay uses next Monday for Saturday when policy is NEXT',
    run: () => {
      const saturday = new Date(Date.UTC(2025, 10, 8)); // 08/11/2025 (sábado)
      const monday = adjustToBusinessDay(saturday, 'NEXT');
      assert.equal(monday.getUTCDate(), 10); // Deve ser 10/11/2025 (segunda)
    },
  },
  {
    name: 'adjustToBusinessDay uses previous Friday for Sunday when policy is PREVIOUS',
    run: () => {
      const sunday = new Date(Date.UTC(2025, 10, 9)); // 09/11/2025 (domingo)
      const friday = adjustToBusinessDay(sunday, 'PREVIOUS');
      assert.equal(friday.getUTCDate(), 7); // Deve ser 07/11/2025 (sexta)
    },
  },
  {
    name: 'getEffectiveClosingDate rolls weekend closing to next business day',
    run: () => {
      const date = getEffectiveClosingDate(2025, 11, 9, 'NEXT');
      assert.equal(date.getUTCDate(), 10); // 09/11 (sábado) → 10/11 (segunda)
    },
  },
  {
    name: 'deriveBillingMonth keeps transactions before closing within same month',
    run: () => {
      const tx = new Date(Date.UTC(2025, 10, 3)); // 03/11/2025
      const billing = deriveBillingMonth(tx, 9, 'NEXT');
      assert.equal(billing, '2025-11'); // Compra antes do fechamento (dia 09)
    },
  },
  {
    name: 'deriveBillingMonth rolls to next month after closing cutoff',
    run: () => {
      const tx = new Date(Date.UTC(2025, 10, 15)); // 15/11/2025
      const billing = deriveBillingMonth(tx, 9, 'NEXT');
      assert.equal(billing, '2025-12'); // Compra após fechamento → próxima fatura
    },
  },
  {
    name: 'deriveBillingMonth handles December rollover',
    run: () => {
      const tx = new Date(Date.UTC(2025, 11, 31)); // 31/12/2025
      const billing = deriveBillingMonth(tx, 15, 'NEXT');
      assert.equal(billing, '2026-01'); // Virada de ano → janeiro/2026
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
