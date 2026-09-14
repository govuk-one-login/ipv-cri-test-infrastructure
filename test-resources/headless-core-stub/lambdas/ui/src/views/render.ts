import type { Express } from "express";
import { Environment, type ILoader, Loader, type LoaderSource } from "nunjucks";
import path from "node:path";
import { FAVICON_PATH, SIGN_IN_PATH, START_PATH, STYLESHEET_PATH, UI_ROOT } from "../paths";
import { govukTemplates } from "./govuk-templates";
import layout from "./templates/layout.njk";
import signIn from "./templates/sign-in.njk";
import start from "./templates/start.njk";

const SERVICE_NAME = "CRI Journey Builder";

const templates: Record<string, string> = {
    ...govukTemplates,
    "layout.njk": layout,
    "sign-in.njk": signIn,
    "start.njk": start,
};

class BundledLoader extends Loader implements ILoader {
    override isRelative(name: string): boolean {
        return name.startsWith("./") || name.startsWith("../");
    }

    override resolve(from: string, to: string): string {
        return path.posix.join(path.posix.dirname(from), to);
    }

    getSource(name: string): LoaderSource {
        const src = templates[name];
        if (src === undefined) {
            throw new Error(`Unknown template: ${name}`);
        }

        return { src, path: name, noCache: false };
    }
}

const nunjucksEnvironment = new Environment(new BundledLoader(), { autoescape: true });

nunjucksEnvironment.addGlobal("serviceName", SERVICE_NAME);
nunjucksEnvironment.addGlobal("stylesheetPath", STYLESHEET_PATH);
nunjucksEnvironment.addGlobal("faviconPath", FAVICON_PATH);
nunjucksEnvironment.addGlobal("root", UI_ROOT);
nunjucksEnvironment.addGlobal("signInPath", SIGN_IN_PATH);
nunjucksEnvironment.addGlobal("startPath", START_PATH);

export const configureViews = (app: Express): void => nunjucksEnvironment.express(app);
