import Image from "next/image";
import React from "react";

export function TypingStationMark({ className = "" }: { className?: string }) {
  return (
    <span
      data-testid="typing-station-mark"
      className={`site-brand-mark ${className}`.trim()}
      aria-hidden="true"
    >
      <Image
        unoptimized
        className="site-brand-mark-image site-brand-mark-image-light"
        src="/typing-station-mark-light.png"
        alt=""
        width="42"
        height="28"
        loading="eager"
      />
      <Image
        unoptimized
        className="site-brand-mark-image site-brand-mark-image-dark"
        src="/typing-station-mark-dark.png"
        alt=""
        width="42"
        height="28"
        loading="eager"
      />
    </span>
  );
}
