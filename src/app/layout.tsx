import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '银行业务活动模拟系统',
  description: '模拟银行4个窗口的业务活动，计算客户平均逗留时间',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">{children}</body>
    </html>
  )
}
