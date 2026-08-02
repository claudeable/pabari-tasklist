import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pil-transmission-lines-app",
  description: "Confidential collaboration for organizations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
