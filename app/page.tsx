import type { Metadata } from "next";

import VaeoraLanding from "@/components/vaeora/VaeoraLanding";

export const metadata: Metadata = {
  title: "VAEORA | Where intelligence takes shape.",
  description: "VAEORA is coming into focus.",
  openGraph: {
    title: "VAEORA | Where intelligence takes shape.",
    description: "Coming into focus.",
    type: "website",
    siteName: "VAEORA",
  },
  twitter: {
    card: "summary",
    title: "VAEORA | Where intelligence takes shape.",
    description: "Coming into focus.",
  },
};

export default function Page() {
  return <VaeoraLanding />;
}
