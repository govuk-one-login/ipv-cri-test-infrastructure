import stylesheet from "govuk-frontend/dist/govuk/govuk-frontend.min.css";
import boldWoff2 from "govuk-frontend/dist/govuk/assets/fonts/bold-b542beb274-v2.woff2";
import lightWoff2 from "govuk-frontend/dist/govuk/assets/fonts/light-94a07e06a1-v2.woff2";
import faviconSvg from "govuk-frontend/dist/govuk/assets/images/favicon.svg";
import { inlineFonts } from "../util/inline-fonts";

export const govukStylesheet = inlineFonts(stylesheet, lightWoff2, boldWoff2);

export const govukFavicon = faviconSvg;
