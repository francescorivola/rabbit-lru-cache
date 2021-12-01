import { Message } from "amqplib";

export const consumer = {
    onMessage: (message: Message | null): void => { console.log(message) }
};
export const publish = jest.fn();
export const assertQueueMock = jest.fn(() => new Promise(resolve => setTimeout(resolve, 0)));
export const createChannelMock = jest.fn(() => new Promise(resolve => setTimeout(() => {
    resolve({
        assertExchange: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        assertQueue: assertQueueMock,
        bindQueue: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        consume: jest.fn((queueName, onMessage) => {
            consumer.onMessage = onMessage;
            return new Promise(resolve => setTimeout(resolve, 0));
        }),
        close: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        cancel: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        publish
    })
}, 0)));
export const emitter = {
    emitError: (error: Error): void => { console.log(error) },
    emitClose: (error: Error): void => { console.log(error) }
};
export const onMock = jest.fn((event, fn) => {
    if (event === "error") {
        emitter.emitError = fn.bind(null);
    } else if (event === "close") {
        emitter.emitClose = fn.bind(null);
    }
});
export const connectMock = jest.fn(() => {
    return new Promise(resolve => setTimeout(() => {
        resolve({
            removeAllListeners: jest.fn(),
            on: onMock,
            close: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
            createChannel: createChannelMock
        });
    }, 0));
});
export const amqplibMock = {
    connect: connectMock
};