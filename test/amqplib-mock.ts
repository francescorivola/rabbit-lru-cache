import { Message } from "amqplib";

export const consumer = {
    onMessage: (message: Message | null): void => { console.log(message) }
};
export const createChannelMock = jest.fn(() => new Promise(resolve => setTimeout(() => {
    resolve({
        assertExchange: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        assertQueue: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        bindQueue: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        consume: jest.fn((queueName, onMessage) => {
            consumer.onMessage = onMessage;
            return new Promise(resolve => setTimeout(resolve, 0));
        }),
        close: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        cancel: jest.fn(() => new Promise(resolve => setTimeout(resolve, 0))),
        publish: jest.fn()
    })
}, 0)));
export const emitter = {
    error: (error: Error): void => { console.log(error) },
    close: (error: Error): void => { console.log(error) }
};
export const onMock = jest.fn((event, fn) => {
    if (event === "error") {
        emitter.error = fn;
    } else if (event === "close") {
        emitter.close = fn;
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