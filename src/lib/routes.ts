// The site is static, so class pages are one page that reads the class from ?id=.
export function classHref(classId: string): string {
  return `/classes/view?id=${encodeURIComponent(classId)}`;
}

/** Where the site lives on its host, e.g. "/Clarion-AI" on GitHub Pages. Links add it themselves. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
