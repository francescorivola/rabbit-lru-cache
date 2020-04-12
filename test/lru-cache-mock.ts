export const delMock = jest.fn();
export const resetMock = jest.fn();
export const getMock = jest.fn();
export const setMock = jest.fn();
export const pruneMock = jest.fn();
export const dumpMock = jest.fn();
export const valuesMock = jest.fn();
export const hasMock = jest.fn();
export const forEachMock = jest.fn();
export const rforEachMock = jest.fn();
export const keysMock = jest.fn();
export const loadMock = jest.fn();
export const peekMock = jest.fn();
export const lengthCalculatorMock = jest.fn();
export const LRUCacheMock = jest.fn(() => ({
    del: delMock,
    reset: resetMock,
    get: getMock,
    set: setMock,
    prune: pruneMock,
    dump: dumpMock,
    values: valuesMock,
    has: hasMock,
    forEach: forEachMock,
    rforEach: rforEachMock,
    keys: keysMock,
    load: loadMock,
    peek: peekMock,
    lengthCalculator: lengthCalculatorMock
}))