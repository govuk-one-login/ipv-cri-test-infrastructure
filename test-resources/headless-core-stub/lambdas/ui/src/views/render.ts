import { Environment, type ILoader, Loader, type LoaderSource } from "nunjucks";
import path from "node:path";
import { govukTemplates } from "./govuk-templates";
import layout from "./templates/layout.njk";
import signIn from "./templates/sign-in.njk";
import start from "./templates/start.njk";

export const STYLESHEET_PATH = "/ui/govuk.css";
export const FAVICON_PATH = "/ui/favicon.svg";

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

const environment = new Environment(new BundledLoader(), { autoescape: true });

export const render = (template: string, context: Record<string, unknown> = {}): string =>
    environment.render(template, {
        serviceName: SERVICE_NAME,
        stylesheetPath: STYLESHEET_PATH,
        faviconPath: FAVICON_PATH,
        ...context,
    });
