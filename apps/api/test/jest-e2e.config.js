/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.json',
      useESM: false,
    }],
  },
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '/node_modules/(?!(@builder)/)',
  ],
  moduleNameMapper: {
    '^@builder/database$': '<rootDir>/../../../packages/database/src/index.ts',
    '^@builder/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@builder/ai-core$': '<rootDir>/../__mocks__/ai-core.ts',
    '^@builder/agent-system$': '<rootDir>/../__mocks__/agent-system.ts',
  },
};
