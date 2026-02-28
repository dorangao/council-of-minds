import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Council of Minds",
  description: "AI-powered virtual advisory meeting for decision quality.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
