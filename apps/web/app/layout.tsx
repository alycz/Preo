import type { Metadata } from "next";
import "./globals.css";
import { DynamicProvider } from "./providers";
import { AppChrome } from "./ui/product";

export const metadata: Metadata = {
  title: "Preo",
  description: "Privacy-first agentic payroll neobank prototype"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DynamicProvider>
          <AppChrome>{children}</AppChrome>
        </DynamicProvider>
      </body>
    </html>
  );
}
