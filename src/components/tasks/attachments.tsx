"use client";

import { useRef, useState } from "react";
import { ACCEPT, TYPE_LABEL, attachmentType, formatSize, linkHost, type AttachmentType } from "@/lib/attachments";
import { toast } from "@/lib/client-hooks";
import { BASE_PATH } from "@/lib/routes";
import { actions } from "@/lib/store";
import type { Attachment } from "@/lib/types";
import { CloseIcon, FileIcon, LinkIcon, PaperclipIcon, UploadIcon } from "../icons";
import { Button, cx, inputClass } from "../ui";

const TYPE_TONE: Record<AttachmentType, string> = {
  pdf: "bg-amber-soft text-amber",
  image: "bg-mint-soft text-mint",
  doc: "bg-sky-soft text-sky",
  slides: "bg-amber-soft text-amber",
  sheet: "bg-mint-soft text-mint",
  media: "bg-brand-soft text-brand",
  text: "bg-canvas text-muted",
  link: "bg-brand-soft text-brand",
};

/** Links and the demo's sample files can be plain anchors; stored files need a signed address first. */
function directHref(a: Attachment): string | null {
  if (a.kind === "link") return a.url ?? null;
  if (a.url?.startsWith("/")) return `${BASE_PATH}${a.url}`;
  return null;
}

function OpenAttachment({
  attachment: a,
  className,
  label,
  children,
}: {
  attachment: Attachment;
  className: string;
  label?: string;
  children: React.ReactNode;
}) {
  const href = directHref(a);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={() => void actions.openAttachment(a)} className={className} aria-label={label}>
      {children}
    </button>
  );
}

/** One file or link: what it is, who added it, and a way to open it. */
export function AttachmentItem({ attachment: a, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const type = attachmentType(a);
  const meta = [a.kind === "link" ? linkHost(a.url) : TYPE_LABEL[type], formatSize(a.size), a.addedBy].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 rounded-[12px] border border-line bg-white py-2.5 pr-2.5 pl-3">
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-[10px]", TYPE_TONE[type])}>
        {a.kind === "link" ? <LinkIcon /> : <FileIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">{a.title}</p>
        <p className="truncate text-[11.5px] text-faint">{meta}</p>
      </div>
      <OpenAttachment
        attachment={a}
        label={`Open ${a.title}`}
        className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-canvas"
      >
        Open
      </OpenAttachment>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${a.title}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-canvas hover:text-ink"
        >
          <CloseIcon />
        </button>
      )}
    </li>
  );
}

export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove?: (a: Attachment) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((a) => (
        <AttachmentItem key={a.id} attachment={a} onRemove={onRemove && a.mine ? () => onRemove(a) : undefined} />
      ))}
    </ul>
  );
}

/** Small chips for a student's files, used where space is tight (marking rows). */
export function AttachmentChips({ items }: { items: Attachment[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((a) => (
        <li key={a.id}>
          <OpenAttachment
            attachment={a}
            className="inline-flex max-w-[220px] items-center gap-1.5 rounded-[8px] border border-line bg-neutral-tag px-2 py-1 text-[11.5px] font-semibold text-neutral-tag-ink transition hover:border-faint hover:text-ink"
          >
            {a.kind === "link" ? <LinkIcon width={12} height={12} /> : <PaperclipIcon width={12} height={12} />}
            <span className="truncate">{a.title}</span>
          </OpenAttachment>
        </li>
      ))}
    </ul>
  );
}

function normaliseUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "Attach a file" and "Add a link" for a task's resources or, with `asWork`, the student's own work. */
export function AddAttachment({ taskId, asWork }: { taskId: string; asWork: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputId = `${asWork ? "work" : "resource"}-${taskId}`;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <UploadIcon />
          {uploading ? "Uploading…" : "Attach a file"}
        </Button>
        <Button variant="secondary" size="sm" aria-expanded={linking} onClick={() => setLinking((v) => !v)}>
          <LinkIcon width={14} height={14} />
          Add a link
        </Button>
        <input
          ref={fileRef}
          id={`${inputId}-file`}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={asWork ? "Attach your work" : "Attach a file for the class"}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setUploading(true);
            const ok = await actions.addAttachment(taskId, { kind: "file", file }, asWork);
            setUploading(false);
            if (ok) toast(`Attached ${file.name}`, "success");
          }}
        />
      </div>
      {linking && (
        <form
          className="flex flex-col gap-2 rounded-[12px] bg-canvas p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const clean = normaliseUrl(url);
            if (!clean) {
              toast("That does not look like a web address. It should start with https://");
              return;
            }
            setSaving(true);
            const ok = await actions.addAttachment(taskId, { kind: "link", title: title || linkHost(clean), url: clean }, asWork);
            setSaving(false);
            if (ok) {
              setUrl("");
              setTitle("");
              setLinking(false);
              toast("Link added", "success");
            }
          }}
        >
          <label htmlFor={`${inputId}-url`} className="text-[12px] font-semibold text-muted">
            Web address
          </label>
          <input
            id={`${inputId}-url`}
            className={cx(inputClass, "h-10")}
            inputMode="url"
            placeholder="https://docs.google.com/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            autoFocus
          />
          <label htmlFor={`${inputId}-title`} className="text-[12px] font-semibold text-muted">
            Name <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            id={`${inputId}-title`}
            className={cx(inputClass, "h-10")}
            placeholder={asWork ? "My essay draft" : "Revision video"}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="mt-1 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLinking(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Adding…" : "Add link"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
