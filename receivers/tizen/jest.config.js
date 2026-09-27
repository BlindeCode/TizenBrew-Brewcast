module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/**/*.test.ts'],
    moduleNameMapper: {
        '^src/Main$': '<rootDir>/test/support/Main.ts',
        '^src/(.*)$': '<rootDir>/service/$1',
        '^common/(.*)$': '<rootDir>/../common/web/$1',
        '^modules/(.*)$': '<rootDir>/node_modules/$1',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
    },
    // Defined by webpack's DefinePlugin in real builds.
    globals: { TARGET: 'tizenOS' },
};
