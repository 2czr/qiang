import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '校园墙',
  description: '校园墙 - 分享校园生活，交流互动平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
