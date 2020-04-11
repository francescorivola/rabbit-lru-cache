const fetch = require("node-fetch");

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function put(itemId, i) {
    const response = await fetch("http://localhost:8080/items/" + itemId, {
        method: "PUT",
        body: JSON.stringify({
            test: "Hi " + i,
            date: new Date()
        }),
        headers: { "Content-Type": "application/json" },
    });
    console.log("put", itemId, response.headers.get("x-server-id"), await response.json());
}

async function get(itemId) {
    const response = await fetch("http://localhost:8080/items/" + itemId);
    console.log("get", itemId,
        response.headers.get("x-server-id"),
        response.headers.get("x-cache"),
        await response.json());
}

async function main() {
    try {
        let i = 0;
        while(true) {
            i++;
            const itemId = i % 10;
            await put(itemId, i);
            await Promise.all([
                get(itemId),
                get(itemId),
                get(itemId),
                get(itemId),
                get(itemId),
                get(itemId)
            ]);
            await Promise.all([
                get(itemId),
                get(itemId),
                get(itemId),
                get(itemId),
                get(itemId),
                get(itemId)
            ]);
            await wait(1000);
        }
    } catch(error) {
        console.error(error);
        process.exit(1);
    }
}
main();