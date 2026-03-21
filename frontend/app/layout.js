import './globals.css'

export const metadata = {
  title: 'SOP AI Training System',
  description: 'Automated SOP summarization, training flow, and quiz generation',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
