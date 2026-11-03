# 🔊 DoneDog sounds — how it works

Sounds are organized **by language**: `fr/` for French, `en/` for English.
The dog only plays the files of the currently selected language
(choose Français / English in Settings or the tray menu).

**The easy way**: run `python scripts/gen-voices.py` → it generates all
missing .wav files (both languages) into `fr/` and `en/` with the right
voice. The table below is if you want to record them yourself.
The app accepts .mp3, .wav and .ogg.

Generate MP3s (Google AI Studio, ElevenLabs, your own voice…) and drop them
**into this folder** with **exactly these names**. As soon as a file exists,
the dog plays it instead of the text bubble / Windows voice. No restart
needed: click the dog, sounds are reloaded.

**Variants**: you can add several versions of the same event by appending
`-2`, `-3`… (e.g. `add-task.mp3`, `add-task-2.mp3`, `add-task-3.mp3`)
→ he picks one at random every time.

## Recording script (suggested lines — improvise, be funny)

| File | When it plays | Suggested line |
|---|---|---|
| `hello.mp3` | app launch | “Woof! DoneDog reporting for duty! I slept fourteen hours, I’m ready to judge you.” |
| `add-task.mp3` | you add a task | “Noted! For a kibble, I could do it for you… No. Just kidding.” |
| `add-task-2.mp3` | (variant) | “Again?! Your brain is a chore factory, human.” |
| `add-task-3.mp3` | (variant) | “Added! That’s a lot for someone who scrolls this much, no?” |
| `many-tasks.mp3` | 6+ tasks pending | “Oh boy. That’s a lot. Breathe. Or run — that’s what I’d do.” |
| `task-done.mp3` | you check a task | “GOOD HUMAN! If you had a tail, you’d be wagging it right now.” |
| `task-done-2.mp3` | (variant) | “One less! I’m proud of you. Well… almost.” |
| `no-tasks.mp3` | you ask for tasks, list empty | “Nothing to do! The nap is therefore mandatory. It’s the law. Woof.” |
| `read-intro.mp3` | just before he reads your list | “Woof woof! Open your ears wide, here comes your shame list:” |
| `read-outro.mp3` | right after the reading | “Go to work, human! Each finished task equals one virtual belly rub.” |
| `wake.mp3` | you wake him up | “HUH?! WHAT?! …I wasn’t sleeping! I was thinking with my eyes closed.” |
| `bored.mp3` | you procrastinate (random) | “I’m watching you procrastinate. It’s fascinating.” |
| `bored-2.mp3` | (variant) | “The ball won’t throw itself, you know.” |
| `bored-3.mp3` | (variant) | “I saw three cat videos go by. Traitor.” |
| `bark.mp3` | generic woof | “Woof!” (a real bark works too) |
| `drop.mp3` | you drop him after a drag | “Hey! I’m a dog, not a frisbee!” |
| `jump.mp3` | he jumps on a window | “Woof! PARKOUR!” |
| `clean-start.mp3` | desktop tidy-up starts | “The cleanup?! Fine. But kibble after. That’s the deal.” |
| `clean-done.mp3` | desktop tidy-up done | “Desktop tidied! Where’s my kibble? I’m waiting.” |
| `level-up.mp3` | he levels up | “WOOF WOOF! Level up! I’m growing right before your eyes.” |
| `zoomies.mp3` | 3 fast clicks = he loses it | “WOOF WOOF WOOF! THE DEVIL LIVES IN ME!” |
| `pant.mp3` | zoomies over, out of breath | *panting* “…ok… I’m better now… woof…” |

## Notes
- **Reading the task list** uses the local Windows voice by default; configuring
  your own Gemini key enables optional online voice generation for short text.
  The bundled recordings handle the intro and outro.
- Format: MP3, WAV or OGG, a few seconds. Volume is adjustable in Settings.
