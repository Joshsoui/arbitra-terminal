import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ARBITRA TERMINAL",
  description: "Global Product Intelligence — See demand before it reaches your market.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
