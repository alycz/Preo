import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DynamicProvider } from "./providers";
import { AppChrome } from "./ui/product";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Preo — Private payroll, allocated automatically",
  description:
    "Receive stablecoin payroll and automatically route it into private, user-defined financial categories. Your employer can't see your investments. Built on Canton."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <DynamicProvider>
          <AppChrome>{children}</AppChrome>
        </DynamicProvider>
      </body>
    </html>
  );
}
