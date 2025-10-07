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

export const metadata = {
  title: "LaundryGo",
  description: "Smart laundry management system",
  themeColor: "#7c3aed", // for theme-color meta
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* PWA Manifest */}
        <link
  rel="manifest"
  href="https://laundryadmin-7d0om5r53-firenadoeds-projects.vercel.app/manifest.json?x-vercel-protection-bypass=qNLeL9bftVvk0prR8xbCdN3iPtyuNCm5"
/>
        <meta name="theme-color" content="#7c3aed" />
        <link rel="icon" href="/icons/icon.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
