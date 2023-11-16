import { register } from "../actions/register";
import { FONT_FAMILY, VERTICAL_ALIGN } from "../constants";
import { setCursorForShape } from "../cursor";
import { ExcalidrawProps } from "../types";
import { getFontString, updateActiveTool } from "../utils";
import { newTextElement } from "./newElement";
import { getContainerElement, wrapText } from "./textElement";
import { isEmbeddableElement } from "./typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
  Theme,
} from "./types";

type EmbeddedLink =
  | ({
      aspectRatio: { w: number; h: number };
      warning?: string;
    } & (
      | { type: "video" | "generic"; link: string }
      | { type: "document"; srcdoc: (theme: Theme) => string }
    ))
  | null;

const ALLOWED_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "figma.com",
  "link.excalidraw.com",
  "gist.github.com",
  "twitter.com",
  "*.simplepdf.eu",
  "stackblitz.com",
  "val.town",
  "giphy.com",
  "dddice.com",
]);

export const getEmbedLink = (link: string | null | undefined): EmbeddedLink => {
  // Do not return <script..
  return null;
};

export const isEmbeddableOrLabel = (
  element: NonDeletedExcalidrawElement,
): Boolean => {
  if (isEmbeddableElement(element)) {
    return true;
  }
  if (element.type === "text") {
    const container = getContainerElement(element);
    if (container && isEmbeddableElement(container)) {
      return true;
    }
  }
  return false;
};

export const createPlaceholderEmbeddableLabel = (
  element: ExcalidrawEmbeddableElement,
): ExcalidrawElement => {
  const text =
    !element.link || element?.link === "" ? "Empty Web-Embed" : element.link;
  const fontSize = Math.max(
    Math.min(element.width / 2, element.width / text.length),
    element.width / 30,
  );
  const fontFamily = FONT_FAMILY.Helvetica;

  const fontString = getFontString({
    fontSize,
    fontFamily,
  });

  return newTextElement({
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
    strokeColor:
      element.strokeColor !== "transparent" ? element.strokeColor : "black",
    backgroundColor: "transparent",
    fontFamily,
    fontSize,
    text: wrapText(text, fontString, element.width - 20),
    textAlign: "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    angle: element.angle ?? 0,
  });
};

export const actionSetEmbeddableAsActiveTool = register({
  name: "setEmbeddableAsActiveTool",
  trackEvent: { category: "toolbar" },
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "embeddable",
    });

    setCursorForShape(app.canvas, {
      ...appState,
      activeTool: nextActiveTool,
    });

    return {
      elements,
      appState: {
        ...appState,
        activeTool: updateActiveTool(appState, {
          type: "embeddable",
        }),
      },
      commitToHistory: false,
    };
  },
});

const validateHostname = (
  url: string,
  /** using a Set assumes it already contains normalized bare domains */
  allowedHostnames: Set<string> | string,
): boolean => {
  try {
    const { hostname } = new URL(url);

    const bareDomain = hostname.replace(/^www\./, "");
    const bareDomainWithFirstSubdomainWildcarded = bareDomain.replace(
      /^([^.]+)/,
      "*",
    );

    if (allowedHostnames instanceof Set) {
      return (
        ALLOWED_DOMAINS.has(bareDomain) ||
        ALLOWED_DOMAINS.has(bareDomainWithFirstSubdomainWildcarded)
      );
    }

    if (bareDomain === allowedHostnames.replace(/^www\./, "")) {
      return true;
    }
  } catch (error) {
    // ignore
  }
  return false;
};

export const extractSrc = (htmlString: string): string => {
  return htmlString;
};

export const embeddableURLValidator = (
  url: string | null | undefined,
  validateEmbeddable: ExcalidrawProps["validateEmbeddable"],
): boolean => {
  if (!url) {
    return false;
  }
  if (validateEmbeddable != null) {
    if (typeof validateEmbeddable === "function") {
      const ret = validateEmbeddable(url);
      // if return value is undefined, leave validation to default
      if (typeof ret === "boolean") {
        return ret;
      }
    } else if (typeof validateEmbeddable === "boolean") {
      return validateEmbeddable;
    } else if (validateEmbeddable instanceof RegExp) {
      return validateEmbeddable.test(url);
    } else if (Array.isArray(validateEmbeddable)) {
      for (const domain of validateEmbeddable) {
        if (domain instanceof RegExp) {
          if (url.match(domain)) {
            return true;
          }
        } else if (validateHostname(url, domain)) {
          return true;
        }
      }
      return false;
    }
  }

  return validateHostname(url, ALLOWED_DOMAINS);
};
