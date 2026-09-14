import { randomBytes } from "node:crypto";
import { createApp } from "../app";

const port = Number(process.env.PORT ?? 3000);

process.env.UI_CREDENTIALS ??= "dev:dev";
process.env.UI_SESSION_KEY ??= randomBytes(32).toString("base64");

createApp().listen(port, () => {
    console.log(`ui listening on http://localhost:${port}/ui`);
    console.log(`creds are ${process.env.UI_CREDENTIALS}`);
});
