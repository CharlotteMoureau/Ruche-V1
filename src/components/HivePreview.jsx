function shouldRenderPreviewImage(previewImage) {
  if (typeof previewImage !== "string") {
    return false;
  }

  const trimmed = previewImage.trim();
  if (!trimmed) {
    return false;
  }

  if (!trimmed.startsWith("data:")) {
    return true;
  }

  return /^data:image\/(webp|jpeg|jpg|png);base64,/i.test(trimmed);
}

export default function HivePreview({ previewImage, emptyLabel }) {
  if (shouldRenderPreviewImage(previewImage)) {
    return (
      <img
        src={previewImage}
        alt={emptyLabel}
        className="hive-preview-image"
        loading="lazy"
      />
    );
  }

  return <p className="hive-preview-empty">{emptyLabel}</p>;
}
