import { VoiceProvider } from "@/core/context/VoiceContext";

export default function IauraLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <VoiceProvider>
      {children}
    </VoiceProvider>
  );
}
