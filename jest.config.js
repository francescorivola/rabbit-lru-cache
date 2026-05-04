module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    coverageDirectory: "./coverage/",
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "./test/tsconfig.json"
            }
        ]
    }
};
