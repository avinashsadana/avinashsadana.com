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
  role: 'Programmes · Operations · Strategy',

  /** The one-line pitch. Setup then claim — simple on purpose. */
  tagline: 'Good ideas are everywhere. I make them work.',

  /**
   * Capability-led, not employer-led. No company name here on purpose — the
   * description should describe what Avinash can do, not where he happens to
   * work. Employers belong in the work history, not the metadata.
   */
  description:
    'Avinash Sadana — good ideas are everywhere; I make them work. Programme management, process design and strategy, from heavy engineering to power manufacturing. Lean Six Sigma Green Belt, MBA in International Business, founder of a music festival and a pan-India cycling community, ultra-distance cyclist and trail runner.',

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
    label: 'Instagram',
    href: 'https://www.instagram.com/avinashsadana/',
    handle: '@avinashsadana',
  },
  {
    label: 'Strava',
    href: 'https://www.strava.com/athletes/31162575',
    handle: 'strava.com/athletes',
  },
  {
    label: 'Cycle N’ Chai on Instagram',
    href: 'https://www.instagram.com/cycle.and.chai/',
    handle: '@cycle.and.chai',
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
  { label: 'Reading', href: '/reading' },
  { label: 'Writing', href: '/writing' },
  { label: 'About', href: '/about' },
] as const;

/** Links that only appear in the footer. */
export const footerNav = [
  { label: 'Contact', href: '/contact' },
  { label: 'Guestbook', href: '/guestbook' },
  { label: 'Résumé', href: '/resume' },
  { label: 'RSS', href: '/rss.xml' },
] as const;
