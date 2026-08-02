import type { Metadata } from "next";

import HomePage from "@/components/pages/HomePage";

export const metadata: Metadata = {
  title: "IAURA — Personal Intelligence System",
  description:
    "IAURA piensa contigo para ayudarte a organizar tu vida, convertir ideas en proyectos y avanzar con claridad.",
};

export default function IauraPage() {
  return <HomePage />;
}
