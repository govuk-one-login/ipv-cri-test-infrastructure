import express, { Router } from "express";
import { startController, signInController, assetsController } from "./controllers";
import { FAVICON_PATH, SIGN_IN_PATH, START_PATH, STYLESHEET_PATH, UI_ROOT } from "./paths";
import { requireSession } from "./util/auth";

export const routes = (): Router => {
    const router = Router();
    const parseForm = express.urlencoded({ extended: false });

    router.get(STYLESHEET_PATH, assetsController.getStylesheet);
    router.get(FAVICON_PATH, assetsController.getFavicon);

    router.get(SIGN_IN_PATH, signInController.get);
    router.post(SIGN_IN_PATH, parseForm, signInController.post);

    router.get(UI_ROOT, requireSession, startController.get);
    router.post(START_PATH, requireSession, parseForm, startController.post);

    return router;
};
