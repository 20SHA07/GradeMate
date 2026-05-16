import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GradeMate",
  description: "Turn syllabus PDFs into smart GPA and grade trackers."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
