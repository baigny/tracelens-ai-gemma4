import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceLens AI — Show your idea",
  description: "Draw in the air or capture an object. Let Gemma interpret your visual.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
