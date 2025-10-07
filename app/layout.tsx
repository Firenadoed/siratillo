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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ✅ Wrap everything in SupabaseProvider */}
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
