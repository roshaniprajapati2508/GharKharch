"use client";

import { useCallback, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedImageBlob } from "@/lib/crop-image";

/**
 * A crop/pan/zoom step between "user picked a file" and "we upload it" -
 * profile photos are shown everywhere as perfect circles, so letting people
 * choose which part of a non-square photo actually lands inside that circle
 * (rather than silently center-cropping or stretching it) is the difference
 * between a "streched"-looking avatar and one that looks intentional.
 */
export function PhotoCropDialog({
  file,
  onCancel,
  onCropped,
}: {
  file: File | null;
  onCancel: () => void;
  onCropped: (blob: Blob) => void | Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const imageSrc = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      await onCropped(blob);
    } finally {
      setProcessing(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open && !processing) {
      URL.revokeObjectURL(imageSrc ?? "");
      onCancel();
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm gap-5" showClose={!processing}>
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
          <DialogDescription>Drag to reposition, pinch or use the slider to zoom.</DialogDescription>
        </DialogHeader>

        {imageSrc && (
          <div className="relative h-64 w-full overflow-hidden rounded-xl bg-muted">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-brand-primary"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {processing ? "Saving…" : "Use photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
