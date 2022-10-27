import { request } from "undici";
import { promisify } from "util";

const wait = promisify(setTimeout);

async function put(itemId, i) {
    const response = await request("http://localhost:8080/items/" + itemId, {
        method: "PUT",
        body: JSON.stringify({
            test: "Hi " + i,
            date: new Date()
        }),
        headers: { "Content-Type": "application/json" }
    });
    console.log(
        "put",
        itemId,
        response.headers["x-server-id"],
        await response.body.json()
    );
}

async function get(itemId) {
    const response = await request("http://localhost:8080/items/" + itemId);
    console.log(
        "get",
        itemId,
        response.headers["x-server-id"],
        response.headers["x-cache"],
        await response.body.json()
    );
}

async function main() {
    try {
        let i = 0;
        while (true) {
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
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
main();
