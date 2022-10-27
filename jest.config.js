module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    coverageDirectory: "./coverage/",
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts"],
    transform: {
        "<regex_match_files>": [
            "ts-jest",
            {
                tsconfig: "./test/tsconfig.json"
            }
        ]
    }
};
