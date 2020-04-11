import once from '../../src/utils/once';

describe("once", () => {

    it("should throw a TypeError if input is not function", () => {
        expect.assertions(2);
        try {
            once<object>({} as unknown as (...args) => object);
        } catch(error) {
            expect(error instanceof TypeError).toBe(true);
            expect(error.message).toBe("Input parameter must be a function");
        }
    });

    it("should return a new function that execute the internal function only once", () => {
        let i = 0;
        function increment(): number {
            i++;
            return i;
        }
        const onceIncrement = once(increment);
        const resultFirstExecution = onceIncrement();
        const resultSecondExecution = onceIncrement();
        expect(resultFirstExecution).toBe(1);
        expect(resultSecondExecution).toBe(1);
    });
});