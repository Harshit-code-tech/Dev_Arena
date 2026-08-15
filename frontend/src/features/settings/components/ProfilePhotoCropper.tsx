import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import "../styles/ProfilePhotoCropper.css";

type Props = {
  source: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (imageData: string) => void;
};

type Point = { x: number; y: number };
type ImageSize = { width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function ProfilePhotoCropper({ source, busy = false, error = null, onCancel, onConfirm }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragOrigin = useRef<{ pointer: Point; offset: Point } | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const viewportSize = viewportRef.current?.clientWidth || 360;
  const baseScale = imageSize.width && imageSize.height
    ? Math.max(viewportSize / imageSize.width, viewportSize / imageSize.height)
    : 1;
  const displayScale = baseScale * zoom;
  const rendered = useMemo(() => ({
    width: imageSize.width * displayScale,
    height: imageSize.height * displayScale,
  }), [displayScale, imageSize.height, imageSize.width]);

  function constrain(next: Point, nextZoom = zoom) {
    const size = viewportRef.current?.clientWidth || viewportSize;
    const scale = imageSize.width && imageSize.height
      ? Math.max(size / imageSize.width, size / imageSize.height) * nextZoom
      : 1;
    const maxX = Math.max(0, (imageSize.width * scale - size) / 2);
    const maxY = Math.max(0, (imageSize.height * scale - size) / 2);
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  function handleZoom(value: number) {
    setZoom(value);
    setOffset((current) => constrain(current, value));
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      pointer: { x: event.clientX, y: event.clientY },
      offset,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current || busy) return;
    const next = {
      x: dragOrigin.current.offset.x + event.clientX - dragOrigin.current.pointer.x,
      y: dragOrigin.current.offset.y + event.clientY - dragOrigin.current.pointer.y,
    };
    setOffset(constrain(next));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOrigin.current = null;
  }

  function resetCrop() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function exportCrop() {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport || !imageSize.width || !imageSize.height) return;

    const size = viewport.clientWidth;
    const scale = Math.max(size / imageSize.width, size / imageSize.height) * zoom;
    const renderedWidth = imageSize.width * scale;
    const renderedHeight = imageSize.height * scale;
    const left = (size - renderedWidth) / 2 + offset.x;
    const top = (size - renderedHeight) / 2 + offset.y;
    const sourceX = clamp(-left / scale, 0, imageSize.width);
    const sourceY = clamp(-top / scale, 0, imageSize.height);
    const sourceWidth = Math.min(size / scale, imageSize.width - sourceX);
    const sourceHeight = Math.min(size / scale, imageSize.height - sourceY);

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    onConfirm(canvas.toDataURL("image/jpeg", 0.94));
  }

  return createPortal(
    <div className="profile-cropper-layer" role="presentation">
      <button type="button" className="profile-cropper-backdrop" aria-label="Close crop window" disabled={busy} onClick={onCancel} />
      <section className="profile-cropper-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-crop-title">
        <header>
          <div>
            <p>Profile image framing</p>
            <h2 id="profile-crop-title">Crop your photo</h2>
          </div>
          <button type="button" className="profile-cropper-close" aria-label="Close crop window" disabled={busy} onClick={onCancel}>×</button>
        </header>

        <div
          ref={viewportRef}
          className="profile-cropper-viewport"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            ref={imageRef}
            src={source}
            alt="Crop preview"
            draggable={false}
            onLoad={(event) => {
              setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            style={{
              width: rendered.width || undefined,
              height: rendered.height || undefined,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
          <div className="profile-cropper-circle" aria-hidden="true" />
          <div className="profile-cropper-grid" aria-hidden="true"><i /><i /><i /><i /></div>
        </div>

        <div className="profile-cropper-controls">
          <label>
            <span>Zoom</span>
            <input type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy} onChange={(event) => handleZoom(Number(event.target.value))} />
          </label>
          <p>Drag the image to position it. The exported profile photo is a high-quality 1024 × 1024 crop.</p>
        </div>

        {error && <div className="profile-cropper-error" role="alert">{error}</div>}

        <footer>
          <button type="button" onClick={resetCrop} disabled={busy}>Reset</button>
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="profile-cropper-save" onClick={exportCrop} disabled={busy || !imageSize.width}>
            {busy ? <span className="profile-cropper-loader" aria-label="Uploading" /> : "Use cropped photo"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
