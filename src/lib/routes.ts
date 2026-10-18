// The site is static, so class and task pages are one page each that reads
// the id from ?id=.
export function classHref(classId: string): string {
  return `/classes/view?id=${encodeURIComponent(classId)}`;
}

export function taskHref(taskId: string): string {
  return `/tasks/view?id=${encodeURIComponent(taskId)}`;
}

/** Where the site lives on its host, e.g. "/Clarion-AI" on GitHub Pages. Links add it themselves. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
