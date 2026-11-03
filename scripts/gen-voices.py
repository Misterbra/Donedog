# Generates all of DoneDog's voices (FR + EN) with Gemini TTS.
# Usage:  python scripts/gen-voices.py          (reads gemini-keys.json)
#         or set GEMINI_API_KEY for a single key.
# Dependency:  pip install google-genai
# The .wav files land in assets/sounds/fr/ and assets/sounds/en/ —
# the app plays them directly (click the dog to reload, no restart).
# The script skips files that already exist, so re-running only fills gaps.

import json
import os
import struct
import sys
import time

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit("Missing package: pip install google-genai")

MODEL = "gemini-3.1-flash-tts-preview"
VOICE = "Algenib"   # deep, gravelly voice — the tired canine manager
SOUNDS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")

# Default acting direction: jaded, unhurried, deadpan.
STYLE_FR = ("Parle en français. Voix grave, fatiguée, pince-sans-rire, débit posé, "
            "comme un vieux manager blasé qui a tout vu. Ne surjoue pas. Dis : ")
STYLE_CRAZY_FR = ("Parle en français. Crie comme un chien surexcité qui a perdu le "
                  "contrôle, débit très rapide, joyeux et chaotique. Dis : ")
STYLE_TIRED_FR = ("Parle en français. Essoufflé, tu reprends ton souffle après avoir "
                  "couru comme un fou, voix grave. Dis : ")
STYLE_HURT_FR = ("Parle en français. Commence par un cri de douleur aigu de chien, "
                 "puis reprends immédiatement une voix grave, digne et blasée. Dis : ")
STYLE_MONK_FR = ("Parle en français. Murmure lentement, comme un moine qui récite une "
                 "prière connue par cœur, voix grave, à moitié endormi, un léger sourire. Dis : ")

STYLE_EN = ("Speak in English. Deep, tired, deadpan voice, unhurried delivery, "
            "like an old jaded manager who has seen it all. Do not overact. Say: ")
STYLE_CRAZY_EN = ("Speak in English. Scream like an overexcited dog that has lost "
                  "control, very fast delivery, joyful and chaotic. Say: ")
STYLE_TIRED_EN = ("Speak in English. Winded, catching your breath after running "
                  "like crazy, deep voice. Say: ")
STYLE_HURT_EN = ("Speak in English. Start with a sharp dog yelp of pain, "
                 "then immediately switch back to a deep, dignified, jaded voice. Say: ")
STYLE_MONK_EN = ("Speak in English. Murmur slowly, like a monk reciting a "
                 "well-known prayer by heart, deep voice, half asleep, a faint smile. Say: ")

LINES = {
    "fr": {
        "hello":        (STYLE_FR, "Wouf. Je note officiellement le début de ta journée productive. On y croit."),
        "add-task":     (STYLE_FR, "Noté. Ça fait quatorze promesses depuis mardi. Je compte, c'est mon travail."),
        "add-task-2":   (STYLE_FR, "D'accord. Je la range avec les autres."),
        "add-task-3":   (STYLE_FR, "Ajouté. Sans commentaire. Le commentaire, c'était ça."),
        "many-tasks":   (STYLE_FR, "Ça fait beaucoup, là. Préviens tes petits-enfants, c'est eux qui finiront."),
        "task-done":    (STYLE_FR, "Tiens. T'en as fini une. J'avais perdu l'habitude, j'ai rien préparé."),
        "task-done-2":  (STYLE_FR, "Bravo. Sincèrement. Ça m'arrive une fois par an, note la date."),
        "no-tasks":     (STYLE_FR, "Liste vide. Soit t'es très fort, soit t'as rien noté. J'ai mon avis."),
        "read-intro":   (STYLE_FR, "Bien. Installe-toi. Voici l'état des promesses."),
        "read-outro":   (STYLE_FR, "Voilà. Moi j'ai fini ma part. C'était de lire."),
        "wake":         (STYLE_FR, "Je dormais pas. Je surveillais l'intérieur de mes paupières."),
        "bored":        (STYLE_FR, "Vingt minutes que je t'observe. Mon diagnostic : rien."),
        "bored-2":      (STYLE_FR, "Je dis pas que tu procrastines. Je dis que la poussière avance plus vite que toi."),
        "bored-3":      (STYLE_FR, "Ta liste vieillit. Moi aussi. L'un de nous deux le vit bien."),
        "bark":         (STYLE_FR, "Wouf."),
        "drop":         (STYLE_FR, "Je l'ai senti passer. On n'en parle plus. Mais je l'ai senti."),
        "jump":         (STYLE_FR, "Hop. Aucun chat ne fait ça. Aucun."),
        "zoomies":      (STYLE_CRAZY_FR, "Wouf wouf wouf ! Mes ancêtres étaient des loups ! Moi je gère une todo list !"),
        "zoomies-2":    (STYLE_CRAZY_FR, "Je cours ! Pourquoi ? Aucune idée ! Je cours !"),
        "pant":         (STYLE_TIRED_FR, "Voilà. Ça devait sortir. On efface tout, t'as rien vu."),
        "clean-start":  (STYLE_FR, "Le ménage. Bien. Quelqu'un devait finir par le faire, et on savait tous les deux que ce serait pas toi."),
        "clean-done":   (STYLE_FR, "Rangé. Croquette. Je te laisse faire le lien."),
        "level-up":     (STYLE_FR, "Niveau supérieur. La direction est fière. La direction, c'est moi."),
        "bury":         (STYLE_FR, "Un os. Enterré. Emplacement confidentiel."),
        "motivation":   (STYLE_FR, "Mon pote. Il faut vraiment que tu fasses de l'oseille. Sinon on est dans la merde. Je dis on : c'est toi qui achètes les croquettes."),
        "motivation-2": (STYLE_FR, "Tu vois une meuf en ce moment ? C'est bien ce que je pensais. Coche des tâches."),
        "motivation-3": (STYLE_FR, "T'es pas fatigué. T'es sous-stimulé. Nuance. Debout."),
        "bonk":         (STYLE_HURT_FR, "Kaï. …Si le but était de me faire taire : non."),
        "yelp":         (STYLE_HURT_FR, "Kaï ! … Pardon. Ça, c'était pas professionnel."),
        "yelp-2":       (STYLE_HURT_FR, "Kaï ! J'espère que ça t'a défoulé. Ta liste, elle, n'a pas bougé."),
        "yelp-3":       (STYLE_HURT_FR, "Aïe. Je le note dans le registre des violences. Page quarante-deux."),
        "mantra":       (STYLE_FR, "Coche. Croquette. Répète."),
        "mantra-2":     (STYLE_MONK_FR, "Coche. Croquette. Répète."),
    },
    "en": {
        "hello":        (STYLE_EN, "Woof. Officially logging the start of your productive day. We believe."),
        "add-task":     (STYLE_EN, "Noted. That's fourteen promises since Tuesday. I count. It's my job."),
        "add-task-2":   (STYLE_EN, "Fine. Filing it with the others."),
        "add-task-3":   (STYLE_EN, "Added. No comment. That was the comment."),
        "many-tasks":   (STYLE_EN, "That's a lot, right there. Warn your grandchildren. They're the ones who'll finish it."),
        "task-done":    (STYLE_EN, "Well, well. You finished one. I'd lost the habit. Didn't prepare anything."),
        "task-done-2":  (STYLE_EN, "Congratulations. Sincerely. Happens once a year. Mark the date."),
        "no-tasks":     (STYLE_EN, "Empty list. Either you're very good, or you wrote nothing down. I have an opinion."),
        "read-intro":   (STYLE_EN, "Good. Sit down. Here is the state of your promises."),
        "read-outro":   (STYLE_EN, "There. My part is done. My part was reading."),
        "wake":         (STYLE_EN, "I wasn't sleeping. I was monitoring the inside of my eyelids."),
        "bored":        (STYLE_EN, "Twenty minutes I've been watching you. My diagnosis: nothing."),
        "bored-2":      (STYLE_EN, "I'm not saying you procrastinate. I'm saying the dust is moving faster than you."),
        "bored-3":      (STYLE_EN, "Your list is getting old. So am I. One of us is handling it well."),
        "bark":         (STYLE_EN, "Woof."),
        "drop":         (STYLE_EN, "I felt that one coming. We never speak of it again. But I felt it."),
        "jump":         (STYLE_EN, "Up. No cat does this. None."),
        "zoomies":      (STYLE_CRAZY_EN, "Woof woof woof! My ancestors were wolves! I run a todo list!"),
        "zoomies-2":    (STYLE_CRAZY_EN, "I run! Why? No idea! I run!"),
        "pant":         (STYLE_TIRED_EN, "There. It had to come out. We erase all of it. You saw nothing."),
        "clean-start":  (STYLE_EN, "The cleanup. Good. Someone had to do it eventually, and we both knew it wouldn't be you."),
        "clean-done":   (STYLE_EN, "Tidied. Kibble. I'll let you connect the dots."),
        "level-up":     (STYLE_EN, "Level up. Management is proud. Management is me."),
        "bury":         (STYLE_EN, "A bone. Buried. Location confidential."),
        "motivation":   (STYLE_EN, "Buddy. You seriously need to make some money. Otherwise we're in trouble. I say we: you're the one buying the kibble."),
        "motivation-2": (STYLE_EN, "Seeing a girl these days? That's what I thought. Check some tasks."),
        "motivation-3": (STYLE_EN, "You're not tired. You're under-stimulated. Nuance. Up."),
        "bonk":         (STYLE_HURT_EN, "Yipe. ...If the goal was to shut me up: no."),
        "yelp":         (STYLE_HURT_EN, "Ow! ...Sorry. That was unprofessional."),
        "yelp-2":       (STYLE_HURT_EN, "Yipe! Hope that felt good. Your list, meanwhile, hasn't moved."),
        "yelp-3":       (STYLE_HURT_EN, "Ow. Logging that in the violence register. Page forty-two."),
        "mantra":       (STYLE_EN, "Check. Kibble. Repeat."),
        "mantra-2":     (STYLE_MONK_EN, "Check. Kibble. Repeat."),
    },
}


def wav_header(data: bytes, rate=24000, bits=16, channels=1) -> bytes:
    bytes_per_sample = bits // 8
    block_align = channels * bytes_per_sample
    byte_rate = rate * block_align
    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + len(data), b"WAVE", b"fmt ", 16, 1,
        channels, rate, byte_rate, block_align, bits, b"data", len(data)
    ) + data


def parse_rate(mime: str) -> int:
    for part in (mime or "").split(";"):
        part = part.strip()
        if part.lower().startswith("rate="):
            try:
                return int(part.split("=", 1)[1])
            except ValueError:
                pass
    return 24000


def load_keys():
    """GEMINI_API_KEY if set, otherwise all keys from gemini-keys.json."""
    env = os.environ.get("GEMINI_API_KEY")
    if env:
        return [env]
    keys_file = os.path.join(os.path.dirname(__file__), "..", "gemini-keys.json")
    try:
        with open(keys_file, "r", encoding="utf-8") as f:
            return [k for k in json.load(f) if k]
    except Exception:
        return []


def main():
    keys = load_keys()
    if not keys:
        sys.exit("No key found: set GEMINI_API_KEY or fill in gemini-keys.json")

    clients = {k: genai.Client(api_key=k) for k in keys}
    config = types.GenerateContentConfig(
        temperature=1,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)
            )
        ),
    )

    done, skipped, failed = 0, 0, []
    for lang, lines in LINES.items():
        out_dir = os.path.join(SOUNDS_DIR, lang)
        os.makedirs(out_dir, exist_ok=True)
        for name, (style, text) in lines.items():
            out = os.path.join(out_dir, f"{name}.wav")
            if os.path.exists(out):
                skipped += 1
                continue
            ok = False
            for key in keys:
                client = clients[key]
                for attempt in range(3):
                    try:
                        resp = client.models.generate_content(
                            model=MODEL,
                            contents=style + '"' + text + '"',
                            config=config,
                        )
                        part = resp.candidates[0].content.parts[0]
                        audio = part.inline_data.data
                        rate = parse_rate(part.inline_data.mime_type)
                        with open(out, "wb") as f:
                            f.write(wav_header(audio, rate=rate))
                        done += 1
                        ok = True
                        print(f"[ok] {lang}/{name}.wav", flush=True)
                        break
                    except Exception as e:
                        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                            print(f"[quota] {lang}/{name}: wait 25s (attempt {attempt + 1}/3)", flush=True)
                            time.sleep(25)
                        else:
                            print(f"[error] {lang}/{name}: {e}", flush=True)
                            time.sleep(5)
                if ok:
                    break
                print(f"[key switch] {lang}/{name}: key exhausted, trying the next one", flush=True)
            if not ok:
                failed.append(f"{lang}/{name}")
            time.sleep(21)   # free quota: 3 requests / minute per key

    print(f"\nDone: {done} generated, {skipped} already present, {len(failed)} failed.")
    if failed:
        print("Re-run later for:", ", ".join(failed), "(the script skips existing files)")


if __name__ == "__main__":
    main()
