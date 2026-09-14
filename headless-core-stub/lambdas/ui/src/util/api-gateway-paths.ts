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

// on /ui/{proxy+} resources serverless-express uses the matched part (e.g. /ui/start arrives as /start) so we need to reconstruct the whole path
export const routeOnFullPath = (req: Request, _res: Response, next: NextFunction) => {
    const { event } = getCurrentInvoke();

    if (event?.path) {
        const query = req.url.split("?")[1];
        req.url = query ? `${event.path}?${query}` : event.path;
    }

    next();
};

// execute-api urls include the stage (/dev/ui) but the custom domain mapping drops it (/ui)
// links and form actions need prefixing with basePath to work on both
export const resolveBasePath = (req: Request, res: Response, next: NextFunction) => {
    const stage = getCurrentInvoke().event?.requestContext?.stage;

    res.locals.basePath = stage && req.hostname.endsWith(".amazonaws.com") ? `/${stage}` : "";

    next();
};
