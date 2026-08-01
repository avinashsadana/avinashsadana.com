# Editing your site

Everything on avinashsadana.com comes from plain text files in `src/content/`.
You do not need to understand the code to change any of it.

**The rule that matters:** edit a file, save it, commit and push. The site
rebuilds itself and goes live in about a minute.

If you get something wrong — a missing field, a bad date — the build **fails
loudly instead of publishing a broken page**. Nothing you type can break the
live site.

---

## Where everything lives

| What you want to change | File |
|---|---|
| Your name, email, tagline, social links | `src/site.config.ts` |
| Jobs and internships | `src/content/experience/` |
| Current project / programme work | `src/content/programs/` |
| WeDesi Festival, Cycle N' Chai | `src/content/ventures/` |
| Racing, rides, Saucony | `src/content/endurance/` |
| Blog posts | `src/content/writing/` |
| Skills and capability groups | `src/content/data/capabilities.yaml` |
| Certifications | `src/content/data/certifications.yaml` |
| Degrees | `src/content/data/education.yaml` |
| Awards and recognition | `src/content/data/achievements.yaml` |

---

## Adding your current programme work

This is the one section still waiting on you.

1. Open `src/content/programs/`
2. Copy `_template.md` to a new file, e.g. `supply-chain-programme.md`
3. Fill in the fields
4. Change `draft: true` to `draft: false`

That's it — it appears on the home page and on `/work` automatically.

`_template.md` itself never shows on the site, so you can leave it there as a
reference.

---

## Publishing the first blog post

One post is already written for you, in your voice, from facts on your résumé:
`src/content/writing/what-an-ultra-taught-me-about-operations.md`

**Read it first and change anything that isn't true or doesn't sound like you.**
It is currently marked `draft: true`, so it is not public. When you're happy
with it, change that one line to `draft: false`.

To write a new post, copy that file, change the filename (the filename becomes
the web address), and update `title`, `description`, `pubDate` and `tags`.

---

## Approving guestbook notes

Visitors can leave notes at `/guestbook`. **Nothing appears publicly until you
approve it.**

1. Go to `avinashsadana.com/admin`
2. Sign in with your admin password
3. Notes waiting for review are at the top — **Publish** or **Delete**

The same page shows every message sent through the contact form. **Reply** opens
your email client with the address already filled in.

---

## Small things to fix when you get a moment

Search the project for `TODO(avinash)` — each one marks a fact only you know:

- `src/content/endurance/deccan-cliffhanger.md` — the year you raced it

---

## Adding a photo of yourself

Drop a photo into `public/` (e.g. `public/avinash.jpg`) and tell Claude — the
about page and hero have space designed for one.

---

## Formatting rules (the only two that trip people up)

**1. A colon followed by a space inside a bullet needs quotes.**

```yaml
# breaks the build
- Led operations across three phases: venue, vendors, crew.

# correct
- >-
  Led operations across three phases: venue, vendors, crew.
```

**2. Apostrophes.** Use the curly `'` (as in `Cycle N' Chai`) — it looks better
and never conflicts with the file format.

---

## Publishing your changes

```bash
git add -A
git commit -m "Update programme work"
git push
```

Vercel deploys automatically. Watch it at
[vercel.com](https://vercel.com/avinash-792e/avinashsadana-com).

To preview locally before pushing:

```bash
npm run dev      # then open http://localhost:4321
```

To check everything still works:

```bash
npm run verify   # types, build, build output, and the full browser test suite
```
