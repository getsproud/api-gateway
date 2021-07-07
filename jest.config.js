module.exports = {
  setupFiles: ['<rootDir>/.jest/setEnvVars.js'],
  silent: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75
    }
  }
}
