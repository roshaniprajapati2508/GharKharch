// Bare canvas math for turning a react-easy-crop selection into an actual
// image file — react-easy-crop only reports *what* to crop (a pixel
// rectangle on the source image), not the cropped pixels themselves.

export type PixelCrop = { x: number; y: number; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Needed so a Supabase-hosted source image (different origin than this
    // page) doesn't taint the canvas and block `toBlob` below.
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.src = src;
  });
}

/**
 * Crops `imageSrc` to `pixelCrop`, downsizes to `outputSize`×`outputSize`
 * (avatars never need to be larger than they're ever displayed), and
 * returns a JPEG blob ready to upload.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  outputSize = 512
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare that image");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare that image"))),
      "image/jpeg",
      0.9
    );
  });
}
