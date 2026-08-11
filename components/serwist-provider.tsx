"use client";

// `@serwist/turbopack/react` (preview) ships its provider without a "use client"
// directive, so a Server Component importing it directly pulls createContext/useState
// into the RSC server bundle and breaks the build ("createContext is not a function").
// This wrapper re-establishes the client boundary ourselves.
import { SerwistProvider as BaseSerwistProvider } from "@serwist/turbopack/react";
import type { ComponentProps } from "react";

export function SerwistProvider(props: ComponentProps<typeof BaseSerwistProvider>) {
  return <BaseSerwistProvider {...props} />;
}
