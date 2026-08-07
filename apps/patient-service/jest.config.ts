import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@healthflow/common$': '<rootDir>/../../libs/common/src',
  },
  clearMocks: true,
};

export default config;
