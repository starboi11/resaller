import sharp from 'sharp';

export type ProcessedListingImage = {
  image: Buffer;
  thumbnail: Buffer;
  mimeType: 'image/webp';
  extension: 'webp';
  width: number;
  height: number;
};

export async function processListingImage(
  bytes: Buffer,
): Promise<ProcessedListingImage> {
  const source = sharp(bytes, {
    failOn: 'warning',
    limitInputPixels: 40_000_000,
  }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height)
    throw new Error('Image dimensions are unavailable');

  const image = await source
    .clone()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const thumbnail = await source
    .clone()
    .resize({
      width: 480,
      height: 480,
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: false,
    })
    .webp({ quality: 76, effort: 4 })
    .toBuffer();

  return {
    image: image.data,
    thumbnail,
    mimeType: 'image/webp',
    extension: 'webp',
    width: image.info.width,
    height: image.info.height,
  };
}
