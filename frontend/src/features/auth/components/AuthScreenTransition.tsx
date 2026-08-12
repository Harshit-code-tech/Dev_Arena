import { useEffect } from "react";
import "../styles/AuthScreenTransition.css";

export type AuthTransitionOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius?: number;
};

export function getAuthTransitionOrigin(element: HTMLElement | null): AuthTransitionOrigin {
  if (!element) {
    return {
      top: window.innerHeight / 2 - 24,
      left: window.innerWidth / 2 - 70,
      width: 140,
      height: 48,
      borderRadius: 0,
    };
  }

  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    borderRadius: Number.parseFloat(window.getComputedStyle(element).borderRadius) || 0,
  };
}

interface Props {
  origin: AuthTransitionOrigin;
  onCovered: () => void;
  duration?: number;
}

/**
 * Uses one full-screen layer and animates only its clip-path. This avoids the
 * repeated layout work caused by animating top/left/width/height separately.
 */
export default function AuthScreenTransition({ origin, onCovered, duration = 620 }: Props) {
  useEffect(() => {
    document.querySelectorAll(".auth-screen-transition").forEach((node) => node.remove());

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const right = Math.max(0, viewportWidth - origin.left - origin.width);
    const bottom = Math.max(0, viewportHeight - origin.top - origin.height);

    const layer = document.createElement("div");
    layer.className = "auth-screen-transition";
    layer.setAttribute("aria-hidden", "true");
    layer.style.setProperty("--auth-transition-top", `${Math.max(0, origin.top)}px`);
    layer.style.setProperty("--auth-transition-right", `${right}px`);
    layer.style.setProperty("--auth-transition-bottom", `${bottom}px`);
    layer.style.setProperty("--auth-transition-left", `${Math.max(0, origin.left)}px`);
    layer.style.setProperty("--auth-transition-radius", `${origin.borderRadius ?? 0}px`);
    layer.style.setProperty("--auth-transition-duration", `${duration}ms`);
    document.body.appendChild(layer);

    const frame = window.requestAnimationFrame(() => layer.classList.add("is-expanded"));
    const coverTimer = window.setTimeout(() => {
      onCovered();
      window.setTimeout(() => layer.classList.add("is-revealing"), 90);
    }, duration);
    const removeTimer = window.setTimeout(() => layer.remove(), duration + 720);

    return () => {
      window.cancelAnimationFrame(frame);
      // Keep the curtain mounted while the route underneath changes.
      if (!layer.classList.contains("is-expanded")) {
        window.clearTimeout(coverTimer);
        window.clearTimeout(removeTimer);
        layer.remove();
      }
    };
  }, [duration, onCovered, origin]);

  return null;
}
