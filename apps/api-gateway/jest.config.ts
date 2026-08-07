import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@healthflow/common$': '<rootDir>/../../libs/common/src',
    '^@healthflow/common/(.*)$': '<rootDir>/../../libs/common/src/$1',
    '^@healthflow/messaging$': '<rootDir>/../../libs/messaging/src',
    '^@healthflow/messaging/(.*)$': '<rootDir>/../../libs/messaging/src/$1',
  },
  clearMocks: true,
};

export default config;
