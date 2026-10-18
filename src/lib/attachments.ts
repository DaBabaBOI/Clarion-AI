import type { Attachment } from "./types";

// Rules for files on tasks. They match the task-files bucket in
// supabase/migrations/20261018060717_task_attachments.sql, so a file the
// browser accepts is one storage accepts too.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** The demo keeps added files in the browser, which has far less room. */
export const MAX_DEMO_FILE_BYTES = 750 * 1024;

export const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "audio/mpeg",
  "audio/mp4",
  "video/mp4",
];

/** For the file picker's `accept`, so people only see files that will upload. */
export const ACCEPT = ALLOWED_TYPES.join(",");

/** Why a file cannot be attached, or null when it can. */
export function fileProblem(file: File, demo: boolean): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "That type of file cannot be attached. Use a PDF, image, document, slides or a spreadsheet.";
  if (demo && file.size > MAX_DEMO_FILE_BYTES) return "In the demo, files up to 750 KB are kept in this browser. Sign in to attach files up to 10 MB.";
  if (file.size > MAX_FILE_BYTES) return "That file is over 10 MB. Try a smaller scan or export it as a PDF.";
  return null;
}

export function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type AttachmentType = "pdf" | "image" | "doc" | "slides" | "sheet" | "media" | "text" | "link";

export function attachmentType(a: Pick<Attachment, "kind" | "mimeType">): AttachmentType {
  if (a.kind === "link") return "link";
  const m = a.mimeType ?? "";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/") || m.startsWith("video/")) return "media";
  if (/presentation|powerpoint/.test(m)) return "slides";
  if (/sheet|excel|csv/.test(m)) return "sheet";
  if (/word|opendocument\.text/.test(m)) return "doc";
  return "text";
}

export const TYPE_LABEL: Record<AttachmentType, string> = {
  pdf: "PDF",
  image: "Image",
  doc: "Document",
  slides: "Slides",
  sheet: "Spreadsheet",
  media: "Audio or video",
  text: "Text",
  link: "Link",
};

/** "en.wikipedia.org" for a link, for the line under its title. */
export function linkHost(url: string | undefined): string {
  try {
    return url ? new URL(url).host.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/** A storage path the bucket accepts: task id, a random folder, then a tidy file name. */
export function storagePath(taskId: string, fileName: string): string {
  const clean = fileName.replace(/[^\w.-]+/g, "_").replace(/^_+/, "").slice(-80) || "file";
  return `${taskId}/${crypto.randomUUID()}/${clean}`;
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
