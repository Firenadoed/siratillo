import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import SupabaseProvider from "@/components/supabase-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* PWA Manifest */}
        <meta name="theme-color" content="#7c3aed" />
        <link rel="icon" href="/icons/icon.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
