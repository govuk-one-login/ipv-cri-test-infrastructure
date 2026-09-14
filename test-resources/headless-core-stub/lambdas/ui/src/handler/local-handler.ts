import { createApp } from "../app";

const port = Number(process.env.PORT ?? 3000);

process.env.UI_BASIC_AUTH_CREDENTIALS ??= "dev:dev";

createApp().listen(port, () => {
    console.log(`ui listening on http://localhost:${port}/ui`);
    console.log(`creds are ${process.env.UI_BASIC_AUTH_CREDENTIALS}`);
});
