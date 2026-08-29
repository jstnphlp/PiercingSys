import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Piercing Corner", template: "%s · Piercing Corner" },
  description: "Book and manage appointments with Piercing Corner in Parañaque.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: { title: "Piercing Corner", description: "Piercing appointments in Parañaque.", images: ["/logo.png"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body className={`${dmSans.variable} ${fraunces.variable}`}>{children}</body></html>;
}
