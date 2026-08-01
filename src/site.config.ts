/**
 * Single source of truth for everything about the person behind the site.
 * Editing this file changes the header, footer, SEO metadata and JSON-LD
 * together — there are no duplicated copies of these values anywhere else.
 */

export const site = {
  name: 'Avinash Sadana',
  shortName: 'Avinash',
  url: 'https://avinashsadana.com',
  email: 'avinashsadana12@gmail.com',
  location: 'Pune, India',
  locality: 'Pune',
  region: 'Maharashtra',
  country: 'IN',

  /** Used as the <title> suffix and in the JSON-LD `jobTitle`. */
  role: 'MBA · International Business',

  /** The one-line pitch. Kept under ~120 characters so it survives as a meta description prefix. */
  tagline: 'Supply chain and operations, built on the discipline of endurance sport.',

  description:
    'Avinash Sadana — MBA candidate in International Business specialising in supply chain, procurement and operations. Founder of The WeDesi Festival and Cycle N’ Chai, Lean Six Sigma Green Belt, and an ultra-distance cyclist.',

  /** Three words that head the hero. Change these and the hero changes. */
  heroWords: ['Operations', 'Ventures', 'Endurance'],
} as const;

export const socials = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/avinashsadana',
    handle: 'in/avinashsadana',
  },
  {
    label: 'Cycle N’ Chai',
    href: 'https://cycleandchai.in',
    handle: 'cycleandchai.in',
  },
  {
    label: 'Email',
    href: `mailto:${site.email}`,
    handle: site.email,
  },
] as const;

export const nav = [
  { label: 'Work', href: '/work' },
  { label: 'Ventures', href: '/ventures' },
  { label: 'Endurance', href: '/endurance' },
  { label: 'Writing', href: '/writing' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
] as const;

/** Links that only appear in the footer. */
export const footerNav = [
  { label: 'Guestbook', href: '/guestbook' },
  { label: 'Résumé', href: '/resume' },
  { label: 'RSS', href: '/rss.xml' },
] as const;
