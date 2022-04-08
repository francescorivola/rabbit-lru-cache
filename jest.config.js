module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageDirectory: "./coverage/",
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.ts"],
  globals: {
    "ts-jest": {
      "tsconfig": "./test/tsconfig.json"
    }
  }
};