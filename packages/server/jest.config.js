// packages/server/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  verbose: true,
  forceExit: true,
};
