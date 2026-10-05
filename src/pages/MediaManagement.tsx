import * as React from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye, ImagePlus, Film } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import type { MediaItem, MediaCategory } from "@/lib/database.types";

const BUCKET = "site-media";
const MAX_BYTES = 50 * 1024 * 1024;
// Allow-list (not block-list): only these MIME types and extensions are accepted.
const ALLOWED: Record<string, "image" | "video"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};
const EXT_OK = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i;

const CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: "gallery", label: "Gallery" },
  { value: "cafe", label: "Cafe" },
  { value: "rooms", label: "Rooms" },
  { value: "video_tour", label: "Video Tour" },
  { value: "other", label: "Other" },
];

function Preview({ item, className }: { item: Pick<MediaItem, "media_type" | "file_url">; className?: string }) {
  return item.media_type === "video" ? (
    <video src={item.file_url} className={className} controls preload="metadata" />
  ) : (
    <img src={item.file_url} alt="" className={className} loading="lazy" />
  );
}

export default function MediaManagement() {
  const { isAdmin, profile } = useAuth();
  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<MediaItem | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<MediaItem | null>(null);
  const [previewing, setPreviewing] = React.useState<MediaItem | null>(null);
  const [deletingBusy, setDeletingBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("media_items").select("*").order("category").order("sort_order");
    if (error) toast.error(error.message);
    setItems((data as MediaItem[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (m: MediaItem) => {
    const { error } = await supabase.from("media_items").update({ is_active: !m.is_active, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  };

  // Reorder: swap sort_order with the neighbour in the same category.
  const move = async (m: MediaItem, dir: -1 | 1) => {
    const same = items.filter((i) => i.category === m.category);
    const idx = same.findIndex((i) => i.id === m.id);
    const other = same[idx + dir];
    if (!other) return;
    const a = m.sort_order === other.sort_order ? m.sort_order + dir : m.sort_order;
    const [r1, r2] = await Promise.all([
      supabase.from("media_items").update({ sort_order: other.sort_order }).eq("id", m.id),
      supabase.from("media_items").update({ sort_order: a }).eq("id", other.id),
    ]);
    if (r1.error || r2.error) return toast.error((r1.error ?? r2.error)!.message);
    load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    const { error } = await supabase.from("media_items").delete().eq("id", deleting.id);
    if (error) {
      setDeletingBusy(false);
      return toast.error(error.message);
    }
    // Row is gone; best-effort removal of the stored file.
    await supabase.storage.from(BUCKET).remove([deleting.storage_path]);
    setDeletingBusy(false);
    setDeleting(null);
    toast.success("Media deleted");
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Media Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Images and videos shown on the public website. Disabled items are hidden from guests.</p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Add Media
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState title="No managed media yet" description="Until you add media here, the website keeps showing its built-in photos and videos." icon={<ImagePlus className="h-6 w-6" />} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Preview</TH>
                <TH>Title</TH>
                <TH>Category</TH>
                <TH>Status</TH>
                <TH>Added</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <button onClick={() => setPreviewing(m)} className="flex h-12 w-16 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                      {m.media_type === "video" ? <Film className="h-5 w-5 text-slate-400" /> : <img src={m.file_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </button>
                  </TD>
                  <TD className="font-medium text-slate-800 dark:text-slate-200">{m.title}</TD>
                  <TD>{CATEGORIES.find((c) => c.value === m.category)?.label ?? m.category}</TD>
                  <TD>
                    <button onClick={() => toggleActive(m)} title="Click to enable/disable">
                      <Badge tone={m.is_active ? "green" : "slate"}>{m.is_active ? "Enabled" : "Disabled"}</Badge>
                    </button>
                  </TD>
                  <TD>{formatDate(m.created_at)}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => move(m, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => move(m, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setPreviewing(m)} aria-label="Preview"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(m)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleting(m)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {editing && (
        <MediaForm
          item={editing === "new" ? null : editing}
          userId={profile?.id ?? null}
          nextOrder={items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <Dialog open={!!previewing} onClose={() => setPreviewing(null)} title={previewing?.title ?? "Preview"} className="max-w-2xl">
        {previewing && <Preview item={previewing} className="max-h-[70vh] w-full rounded-xl object-contain" />}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this media?"
        description={`"${deleting?.title ?? ""}" will be removed from the website and its file deleted. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deletingBusy}
      />
      {!isAdmin && null}
    </div>
  );
}

function MediaForm({
  item,
  userId,
  nextOrder,
  onClose,
  onSaved,
}: {
  item: MediaItem | null;
  userId: string | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [caption, setCaption] = React.useState(item?.caption ?? "");
  const [category, setCategory] = React.useState<MediaCategory>(item?.category ?? "gallery");
  const [active, setActive] = React.useState(item?.is_active ?? true);
  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);

  const onPick = (f: File | null) => {
    if (!f) return setFile(null);
    if (!ALLOWED[f.type] || !EXT_OK.test(f.name)) {
      toast.error("Only JPG, PNG, WebP, GIF images or MP4, WebM, MOV videos are allowed");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File is too large (max 50 MB)");
      return;
    }
    setFile(f);
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!item && !file) return toast.error("Choose a file to upload");
    setSaving(true);
    try {
      let fields: Partial<MediaItem> = {};
      let oldPath: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
        const path = `${category}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        fields = { file_url: data.publicUrl, storage_path: path, media_type: ALLOWED[file.type] };
        oldPath = item?.storage_path ?? null;
      }
      const base = { title: title.trim(), caption: caption.trim() || null, category, is_active: active, updated_at: new Date().toISOString() };
      if (item) {
        const { error } = await supabase.from("media_items").update({ ...base, ...fields }).eq("id", item.id);
        if (error) throw error;
        if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]); // replaced file
      } else {
        const { error } = await supabase.from("media_items").insert({ ...base, ...fields, sort_order: nextOrder, created_by: userId });
        if (error) throw error;
      }
      toast.success(item ? "Media updated" : "Media added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={item ? "Edit Media" : "Add Media"} className="max-w-md">
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rooftop sunset" />
        </div>
        <div>
          <Label>Caption (optional)</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{item ? "Replace file (optional)" : "File"}</Label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 dark:text-slate-300"
          />
          {item && !file && <Preview item={item} className="mt-2 max-h-32 rounded-lg" />}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Enabled (visible on website)
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
    </Dialog>
  );
}
