import { vi } from 'vitest';

export const bulkExpensesAction = vi.fn().mockResolvedValue({
  success: true,
  updatedCount: 0,
  deletedCount: 0,
});
