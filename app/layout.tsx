import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audiencias — Segmentador de Creative Center",
  description: "Cruzá contactos y ventas, creá segmentos y exportalos. Todo se procesa de forma privada en tu navegador.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
