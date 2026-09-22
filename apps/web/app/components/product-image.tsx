'use client';

import { useState } from 'react';

type ProductImageProps = {
  alt: string;
  src?: string;
};

export function ProductImage({ alt, src }: ProductImageProps) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return (
      <div className="product-image-fallback" role="img" aria-label={alt}>
        <span aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
