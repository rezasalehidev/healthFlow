import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@healthflow/common$': '<rootDir>/../../libs/common/src',
    '^@healthflow/redis$': '<rootDir>/../../libs/redis/src',
  },
  clearMocks: true,
};

export default config;
