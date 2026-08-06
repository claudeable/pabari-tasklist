import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pabari Shelf",
  description: "Pabari Group — Document Library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, Arial, sans-serif", background: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}
