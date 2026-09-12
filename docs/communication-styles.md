# Communication Styles

Two engineers can get the same answer from the same agent and have completely different
experiences of it. One reads a careful, qualified paragraph as thorough; the other reads it as
padding and skips to the last line. One wants every tradeoff surfaced unprompted; the other wants
the question answered and nothing more. Neither is wrong — people take in information differently,
and always have.

**A communication style is a short description of how you want to be talked to, handed to your
agent at the start of every session.** It isn't a cosmetic preference. When the register is wrong,
every exchange costs a little more attention than it should — re-reading to find the answer, or
asking again for the detail that got left out. When it's right you stop noticing the interface and
just work.

> A style doesn't shrink the model's output. But reaching alignment in two exchanges instead of
> five saves real tokens — and your own mental energy, which is the scarcer of the two.

## Four styles come in the box, and none of them is you

| Style | Reads like |
|---|---|
| **Direct** | Terse and plain. Full sentences, no padding. |
| **High-Level** | Leads with the big picture, follows you into detail on demand. |
| **Socratic** | Surfaces the deciding question before the answer, then answers it. |
| **Caveman** | Highly abbreviated English. Drops articles and filler, keeps meaning. |

These four are examples. They're here to show the range and give you something concrete to react
to — try one, notice what grates, and that reaction is the raw material for your own. The feature
pays off when the style is yours, so treat the shipped four as starting points rather than a menu
you're meant to choose from. [Writing your own](#writing-your-own) is the intended destination.

A style is a short markdown file with six sections — **Tone**, **Structure**, **Length**,
**Vocabulary**, **Depth** and **Avoid** — a few bullets each. Three of `Direct`'s six:

```
## Tone
- Plain and professional. Neutral warmth.
- State things. Don't soften, don't sell.

## Structure
- Conclusion first. Reasoning after, only if it changes what they'd do.
- Prose for one idea. Bullets for three or more.

## Avoid
- Preamble, throat-clearing, restating the question.
- Hedging where you're confident.
- Offering three options when one is right.
```

Short and specific on purpose.  It loads into your agent's context every session, so it earns its
space in bullets rather than paragraphs.

## Trying one, and keeping it

| What you type | What it does | Lasts |
|---|---|---|
| `/rad-communication direct` | Adopts that style right now | This session |
| `/rad-communication` | Adopts your default style right now | This session |
| `/rad-communication default direct` | Makes it your default | Future sessions |
| `/rad-communication enable` · `disable` | Whether your default loads by itself at session start | Future sessions |
| `/rad-communication help` | Has the agent explain the feature and list what's installed | — |
| Anything else you type | Opens a conversation about your style — see below | — |

The first two rows are how you audition a style: it applies immediately, costs nothing beyond the
session, and is gone next time. Switching again mid-session replaces the previous style rather
than blending with it.

The feature ships **off**, with `High-Level` pre-selected, so `enable` is usually the only setup
step. The two persistent settings are genuinely separate — naming a default doesn't turn the
feature on, and turning it on uses whatever default is already named.

You can set both without spending tokens: the dashboard's gear-icon config panel has a
**Communication Style** section with an **Enabled** switch and a **Style** dropdown. See
[Dashboard](dashboard.md) and [Configuration](configuration.md).

## Writing your own

Anything you type that isn't one of the routes above starts a conversation instead — including a
complaint. *"You're over-explaining"* is a perfectly good way to open one.

The agent works from irritation rather than abstraction, because that's the question people can
actually answer. *"What tone do you want?"* asks for a vocabulary most of us have never needed;
*"what does a coworker do that drives you up the wall?"* is answerable instantly and far more
precise. Expect it to play back a couple of lines written in the style you're describing, too —
reacting to a register is much easier than specifying one.

- **Where it goes**: saved into `~/.radorc/communication-styles/custom/`, which upgrades and
  uninstalls leave alone.  Your styles are yours.
- **Keep it short**: 25–50 lines. It's in the context window every session, and a long
  conversation should distill into a short file, not a long one.
- **Editing a shipped style forks it**: the four above are overwritten on upgrade, so the agent
  copies one into `custom/` under a new name and points your default at the copy.  Ask to "make
  Direct a little warmer" and that's what happens.

## What a style never touches

**A style shapes how the agent talks to you.  That is the whole of it.** It never reaches:

- Code, comments, tests, or commit messages
- Any document the pipeline reads — Requirements, Master Plans, Phase Plans, Task Handoffs, reviews
- What the agent decides to do, or which tools it reaches for

Run an entire project under `Caveman` and the code, the commits and the planning documents come
out exactly as they would have. The conversation is the only thing that changes.

> The fence matters more than it looks.  A register that's a pleasure to read would be a liability
> in a Task Handoff a coder has to follow literally, or in a commit message your teammates read
> next year.

See [Document Types](document-types.md) for the documents in question and
[Subagents](subagents.md) for who reads them.

## A separate layer from ambient awareness

[Ambient awareness](ambient-awareness.md) governs what your agent *knows* at session start; a
communication style governs how it *talks to you*. They ride the same session start and share
nothing else — each is configured on its own, and a style still applies with ambient awareness set
to `off`.

That pairing is more common than it sounds: the person who turns the briefing off to keep their
terminal quiet is often exactly the person who wants a terse register too.

>Contributing to Rad Orc?  How the catalog is read, what part of a style file actually reaches the
>agent, and where the fence above is written are covered in
>[Communication Style Internals](internals/communication-style.md).

---

**Read Next:** [Ambient Awareness](ambient-awareness.md) · [Skills](skills.md) ·
[Configuration](configuration.md) · [Dashboard](dashboard.md) · [Docs Viewer](docs-viewer.md)
