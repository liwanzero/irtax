import { useEffect } from "react";

function setMetaTag(attr: "name" | "property", key: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

interface PageMeta {
  title: string;
  description: string;
  noindex?: boolean;
}

/** Updates the document title/description per route — this is a single-page app, so
 * index.html's static tags only cover the "/" route otherwise. */
export function usePageMeta({ title, description, noindex = false }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    setMetaTag("name", "description", description);
    setMetaTag("property", "og:title", title);
    setMetaTag("property", "og:description", description);
    setMetaTag("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, noindex]);
}
