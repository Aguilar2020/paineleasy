import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Huawei Network Manager — Painel de Gerenciamento e Provisionamento ISP",
  description:
    "Sistema web profissional para gerenciamento, descoberta SSH e provisionamento simplificado de switches e roteadores Huawei VRP em provedores de internet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

