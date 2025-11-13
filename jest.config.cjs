/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    setupFiles: ['<rootDir>/jest.setup.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    coverageDirectory: '<rootDir>/coverage',
};
