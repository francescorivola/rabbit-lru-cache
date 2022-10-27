export const deleteMock = jest.fn();
export const clearMock = jest.fn();
export const getMock = jest.fn();
export const setMock = jest.fn();
export const purgeStaleMock = jest.fn();
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
    delete: deleteMock,
    clear: clearMock,
    get: getMock,
    set: setMock,
    purgeStale: purgeStaleMock,
    dump: dumpMock,
    values: valuesMock,
    has: hasMock,
    forEach: forEachMock,
    rforEach: rforEachMock,
    keys: keysMock,
    load: loadMock,
    peek: peekMock,
    lengthCalculator: lengthCalculatorMock
}));
