import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "IAURA",
  title: {
    default:
      "IAURA — Personal Intelligence System",
    template: "%s | IAURA",
  },
  description:
    "IAURA piensa contigo para ayudarte a organizar tu vida, convertir ideas en proyectos y avanzar con claridad.",
  keywords: [
    "IAURA",
    "personal intelligence",
    "life operating system",
    "AI companion",
    "goals",
    "habits",
    "projects",
  ],
  openGraph: {
    title:
      "IAURA — Personal Intelligence System",
    description:
      "Think better. Build boldly. Live with intention.",
    type: "website",
    locale: "es_US",
    siteName: "IAURA",
  },
  twitter: {
    card: "summary",
    title:
      "IAURA — Personal Intelligence System",
    description:
      "Think better. Build boldly. Live with intention.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-419"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
