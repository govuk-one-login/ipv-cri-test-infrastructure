import { getCurrentInvoke } from "@codegenie/serverless-express";
import type { NextFunction, Request, Response } from "express";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Locals {
            basePath: string;
        }
    }
}

export const resolveBasePath = (req: Request, res: Response, next: NextFunction) => {
    const { event } = getCurrentInvoke();
    const stage = event?.requestContext?.stage;

    if (event?.path) {
        const query = req.url.split("?")[1];
        req.url = query ? `${event.path}?${query}` : event.path;
    }

    res.locals.basePath = stage && req.hostname.endsWith(".amazonaws.com") ? `/${stage}` : "";

    const redirect = res.redirect.bind(res);
    res.redirect = ((...args: [string] | [number, string]) => {
        const url = args.length === 1 ? args[0] : args[1];
        const prefixed = url.startsWith("/") ? `${res.locals.basePath}${url}` : url;

        return args.length === 1 ? redirect(prefixed) : redirect(args[0], prefixed);
    }) as Response["redirect"];

    next();
};
