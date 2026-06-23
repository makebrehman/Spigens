import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { Unbounded, Inter, Poppins, Sora, Space_Grotesk, Outfit, DM_Serif_Display, Bricolage_Grotesque } from 'next/font/google'

const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
})

const poppins = Poppins({ subsets: ['latin'], weight: ['400','500','600','700','800'], variable: '--font-poppins' })
const sora = Sora({ subsets: ['latin'], weight: ['400','600','700','800'], variable: '--font-sora' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400','500','700'], variable: '--font-space' })
const outfit = Outfit({ subsets: ['latin'], weight: ['400','500','600','700','800'], variable: '--font-outfit' })
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: ['400'], variable: '--font-dmserif' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400','600','700','800'], variable: '--font-bricolage' })

export const metadata: Metadata = {
  title: 'Spigens',
  description: 'Spigens — end-to-end encrypted chat',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={`${unbounded.className} ${poppins.variable} ${sora.variable} ${spaceGrotesk.variable} ${outfit.variable} ${dmSerif.variable} ${bricolage.variable} bg-[#0a0a0a] text-white overscroll-none overflow-hidden`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
