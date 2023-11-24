import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Repuestos Mérida',
  description: 'aplicación movíl Repuestos Mérida',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
      <link rel="icon" href="/osoicon.ico" type="image/x-icon" sizes="16x16"/>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
