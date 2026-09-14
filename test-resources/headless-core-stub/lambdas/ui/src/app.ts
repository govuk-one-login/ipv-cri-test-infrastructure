import express, { type Express } from "express";
import { routes } from "./routes";
import { resolveBasePath } from "./util/base-path";
import { configureNunjucksViews } from "./views/nunjucks";

export const createApp = (): Express => {
    const app = express();

    app.set("trust proxy", true); // required when sat behind api gateway to make Secure cookies work properly
    configureNunjucksViews(app);
    app.use(resolveBasePath);
    app.use(express.urlencoded({ extended: false }));
    app.use(routes());

    return app;
};
