import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piercing System",
  description: "Piercing studio management system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
