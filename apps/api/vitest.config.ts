import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration suites share one *_e2e database. Their setup/cleanup must
    // not introduce unrelated Serializable predicate conflicts into checkout.
    // The last-unit test still submits its two checkouts concurrently.
    fileParallelism: process.env.RUN_DB_TESTS !== '1',
  },
});
