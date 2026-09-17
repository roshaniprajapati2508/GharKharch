"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/context/household-context";
import { getMyProfile, updateMyProfile, setMyAvatarUrl } from "@/lib/actions/profile";
import { ProfileIllustration } from "@/components/shared/illustrations";
import { PhotoCropDialog } from "@/components/shared/photo-crop-dialog";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB, matches the storage bucket's file_size_limit (migration 012)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function ProfilePage() {
  const { userId, displayName: contextDisplayName } = useHousehold();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getMyProfile();
      if (result.data) {
        setDisplayName(result.data.display_name ?? "");
        setUsername(result.data.username ?? "");
        setAvatarUrl(result.data.avatar_url);
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);
    const result = await updateMyProfile({
      display_name: displayName.trim() || undefined,
      username: username.trim() ? username.trim().toLowerCase() : null,
    });
    setSaving(false);
    if (result.error !== null) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Profile updated");
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use a JPG, PNG, WEBP or GIF image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5MB");
      return;
    }

    // Don't upload yet - let the person choose which part of the photo
    // lands inside the circular avatar first (see PhotoCropDialog).
    setPendingCropFile(file);
  }

  async function handleCropped(blob: Blob) {
    setUploading(true);
    const previousUrl = avatarUrl;
    try {
      const supabase = createClient();
      // Cropped output is always a JPEG (see getCroppedImageBlob), regardless
      // of the source file's original format.
      const path = `${userId}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage.from("profile-images").upload(path, blob, {
        upsert: true,
        cacheControl: "3600",
        contentType: "image/jpeg",
      });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from("profile-images").getPublicUrl(path);
      // Cache-bust so the new image shows immediately even though the path is unchanged.
      const bustedUrl = `${publicUrl.publicUrl}?t=${Date.now()}`;

      const result = await setMyAvatarUrl(bustedUrl);
      if (result.error !== null) throw new Error(result.error);

      setAvatarUrl(bustedUrl);
      setPendingCropFile(null);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload that photo", {
        action: { label: "Retry", onClick: () => fileInputRef.current?.click() },
      });
      setAvatarUrl(previousUrl);
      setPendingCropFile(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    setUploading(true);
    const supabase = createClient();
    // Best-effort cleanup - the profile row's avatar_url is the source of truth for what's shown,
    // so we clear that regardless of whether the storage object list/remove succeeds.
    try {
      const { data: files } = await supabase.storage.from("profile-images").list(userId);
      if (files && files.length > 0) {
        await supabase.storage.from("profile-images").remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch {
      // ignore - clearing the DB column below is what actually controls what's displayed
    }
    const result = await setMyAvatarUrl(null);
    setUploading(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    setAvatarUrl(null);
    toast.success("Photo removed");
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center gap-2">
        <Link href="/more" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Your profile</h1>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <ProfileIllustration className="h-24 w-auto animate-pulse" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <UserAvatar name={displayName || contextDisplayName} avatarUrl={avatarUrl} className="h-24 w-24" textClassName="text-2xl" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "absolute -bottom-1 -right-1 flex h-9 w-9 min-h-9 min-w-9 aspect-square shrink-0 items-center justify-center rounded-full border-2 border-background bg-brand-primary p-0 text-white shadow-sm transition-transform active:scale-95",
                  uploading && "opacity-70"
                )}
                aria-label="Change photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 shrink-0" />}
              </button>
              <input ref={fileInputRef} type="file" accept={ALLOWED_TYPES.join(",")} className="hidden" onChange={handleFileSelected} />
              <PhotoCropDialog file={pendingCropFile} onCancel={() => setPendingCropFile(null)} onCropped={handleCropped} />
            </div>
            {avatarUrl && !uploading && (
              <button onClick={handleRemovePhoto} className="flex items-center gap-1 text-xs font-medium text-destructive">
                <X className="h-3 w-3" /> Remove photo
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  placeholder="optional"
                  className="pl-7"
                  maxLength={20}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">3-20 characters: lowercase letters, numbers, dot or underscore.</p>
            </div>
            <Button size="lg" loading={saving} onClick={handleSave} className="mt-1">
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
