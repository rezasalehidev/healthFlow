import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@healthflow/common$': '<rootDir>/../../libs/common/src',
    '^@healthflow/messaging$': '<rootDir>/../../libs/messaging/src',
  },
  clearMocks: true,
};

export default config;
