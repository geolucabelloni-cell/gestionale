import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_NOME_STUDIO || "Gestionale Studio",
  description: "Gestionale clienti, pratiche e documenti per studi di diritto dell'immigrazione",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
