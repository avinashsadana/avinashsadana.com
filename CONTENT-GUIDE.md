# Editing your site

Everything on avinashsadana.com comes from plain text files. You do not need to
understand the code to change any of it.

**The rule that matters:** edit a file, save it, and the site rebuilds itself in
about a minute.

If you get something wrong — a missing field, a bad date — the build **fails
loudly instead of publishing a broken page**. Nothing you type can take the
site down.

---

## Step 0 — do this once

Your edits on GitHub will not go live until Vercel is allowed to watch the
repository. It needs your browser, so it is the one thing that cannot be done
for you.

1. Open **https://vercel.com/avinash-792e/avinashsadana-com/settings/git**
2. Click **Connect Git Repository**
3. Choose **GitHub**, authorise it, and pick `avinashsadana/avinashsadana.com`

You only ever do this once. After it, every edit publishes automatically.

---

## Writing a new article

### 1. Go to the writing folder

**https://github.com/avinashsadana/avinashsadana.com/tree/main/src/content/writing**

### 2. Click **Add file → Create new file**

### 3. Name the file

The filename becomes the web address, so use lowercase words joined by hyphens
and end it with `.md`:

```
what-procurement-taught-me.md
```

That becomes `avinashsadana.com/writing/what-procurement-taught-me`.

### 4. Paste this, then write

```markdown
---
title: What procurement taught me about saying no
description: >-
  One or two sentences. This shows on the writing page, in the newsletter,
  and in the preview when someone shares the link.
pubDate: 2026-08-05
tags:
  - Operations
  - Business Models
draft: false
---

Your first paragraph. Just write normally — no formatting needed.

Leave a blank line between paragraphs and they come out as paragraphs.

## A heading, if you want one

More writing.

**Bold** with two stars either side. *Italic* with one.

- A bullet
- Another bullet

> An indented quote, if you need one.
```

Only four things need your attention:

| Field | What to put |
|---|---|
| `title` | The headline |
| `description` | 1–2 sentences — used on the site, in the newsletter, and in link previews |
| `pubDate` | Today's date as `YYYY-MM-DD` |
| `tags` | One to three. Reuse existing ones where you can: Operations, Business Models, Endurance, Ventures, Supply Chain, Bikepacking |

`draft: false` publishes it. Set `draft: true` to keep working on it privately.

### 5. Scroll down, click **Commit changes**

Done. Live in about a minute at `avinashsadana.com/writing`.

---

## Emailing it to subscribers

Publishing does **not** send an email. That is deliberate — you decide when.

1. Go to **avinashsadana.com/admin** and sign in
2. Under **Send a newsletter**, find the article
3. Click **Preview & send** — you see the exact email and how many people get it
4. Click **Send it** and confirm

Within a day of publishing, you will also get a *"Ready to send"* email
reminding you. It never sends on its own.

An article can only be sent once. The site enforces that, not your memory.

---

## Two formatting rules that trip people up

**1. A colon followed by a space inside a bullet needs quoting.**

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

## Where everything else lives

| What you want to change | File |
|---|---|
| Your name, email, tagline, social links | `src/site.config.ts` |
| Jobs | `src/content/experience/` |
| WeDesi Festival, Cycle N' Chai | `src/content/ventures/` |
| Racing, rides, running | `src/content/endurance/` |
| The timeline graphic | `src/content/data/timeline.yaml` |
| The bookshelf | `src/content/data/books.yaml` |
| Skills | `src/content/data/capabilities.yaml` |
| Certifications | `src/content/data/certifications.yaml` |
| Degrees | `src/content/data/education.yaml` |
| Awards | `src/content/data/achievements.yaml` |

Each file has comments at the top explaining its fields. Copy an existing entry
and change the words — that is always the safest way.

---

## Still to fill in

Search the project for `TODO(avinash)`:

- `src/content/endurance/deccan-cliffhanger.md` — the year you raced it

And the 365-day run streak is missing from the timeline because I do not know
which year it ran. Add it to `src/content/data/timeline.yaml` when you know.

---

## Checking before you publish

If you ever want to preview locally:

```bash
npm run dev      # http://localhost:4321
npm run verify   # types, build, and the full browser test suite
```

Neither is required. Committing on GitHub is enough.
