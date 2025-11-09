// Permite usar afterEach, beforeAll, etc. sem erro de tipo no Vitest
declare var afterEach: typeof import('vitest')['afterEach'];
declare var beforeAll: typeof import('vitest')['beforeAll'];
declare var afterAll: typeof import('vitest')['afterAll'];
declare var describe: typeof import('vitest')['describe'];
declare var it: typeof import('vitest')['it'];
declare var expect: typeof import('vitest')['expect'];
