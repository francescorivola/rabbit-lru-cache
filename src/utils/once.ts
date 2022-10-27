export default function once<T>(fn: (...args) => T): (...args) => T {
    if (typeof fn !== "function") {
        throw new TypeError("Input parameter must be a function");
    }
    let result: T;
    let executed = false;
    return function onceFunc(...args): T {
        if (executed) {
            return result;
        }
        result = fn.call(null, ...args);
        executed = true;
        return result;
    };
}
