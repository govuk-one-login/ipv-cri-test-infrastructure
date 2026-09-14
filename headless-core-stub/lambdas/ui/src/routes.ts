import { Router } from "express";
import { startController, assetsController } from "./controllers";
import { FAVICON_PATH, START_PATH, STYLESHEET_PATH, UI_ROOT } from "./paths";

export const routes = (): Router => {
    const router = Router();

    router.get(STYLESHEET_PATH, assetsController.getStylesheet);
    router.get(FAVICON_PATH, assetsController.getFavicon);

    router.get(UI_ROOT, startController.get);
    router.post(START_PATH, startController.post);

    return router;
};
