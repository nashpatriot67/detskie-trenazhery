"""Reproduce the fixed coach clips locally; never sends child text anywhere.

Run with the existing /workspace/scratch/tts-env/bin/python. Requires the
official Silero v5_6_ru model and ffmpeg/ffprobe already used by this project.
The exported motion bank is authoritative for cue IDs, text and minimum tempo.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = {"model": "Silero v5_6_ru", "speaker": "kseniya", "sampleRate": 24000,
            "putAccent": True, "putStressHomo": True, "putYo": True,
            "putYoHomo": True, "mp3Quality": 3, "revision": 1}


def export_cues():
    program = "const fs=require('fs'),vm=require('vm'),c=vm.createContext({});vm.runInContext(fs.readFileSync('coach-plan.js','utf8'),c);console.log(JSON.stringify(c.CoachMovementPlan.CUES));"
    return json.loads(subprocess.check_output(["node", "-e", program], cwd=ROOT, text=True))


def stress(text):
    # Keep visible text natural. Explicit accents only settle pronunciation in
    # the fixed narration; they never change a prompt or a child's answer.
    replacements = {"Поднимись на носки.": "Подним+ись на носк+и.",
                    "Плавно опусти пятки.": "Пл+авно опуст+и п+ятки.",
                    "Плавно оттолкнись от стены.": "Пл+авно оттолкн+ись от стен+ы.",
                    "Мягко согни руки.": "М+ягко согн+и р+уки.",
                    "Опусти и расслабь.": "Опуст+и и рассл+абь."}
    return replacements.get(text, text)


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--model", default="/workspace/scratch/tts-models/v5_6_ru.pt")
    args.add_argument("--limit", type=int, default=0)
    options = args.parse_args()
    cues = export_cues()
    target = ROOT / "audio/coach"
    target.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    model = torch.package.PackageImporter(options.model).load_pickle("tts_models", "model")
    model.to(torch.device("cpu"))
    started = time.monotonic()
    clips = {}
    for number, (cue_id, cue) in enumerate(cues.items()):
        if options.limit and number >= options.limit:
            break
        if cue_id != cue["id"] or not cue_id.replace("-", "").isalnum():
            raise ValueError("Invalid cue ID: " + cue_id)
        text = cue["text"].strip()
        minimum = float(cue["minDuration"])
        if not text or not math.isfinite(minimum) or not .5 <= minimum <= 15:
            raise ValueError("Invalid cue: " + cue_id)
        speech = stress(text)
        fingerprint = hashlib.sha256(json.dumps([SETTINGS, speech, minimum], ensure_ascii=False).encode()).hexdigest()
        audio_file = target / (cue_id + ".mp3")
        metadata_file = target / (cue_id + ".json")
        if audio_file.exists() and metadata_file.exists():
            saved = json.loads(metadata_file.read_text())
            if saved.get("fingerprint") == fingerprint and saved.get("sha256") == hashlib.sha256(audio_file.read_bytes()).hexdigest():
                clips[cue_id] = saved
                continue
        with torch.inference_mode():
            result = model.apply_tts(text=speech, speaker="kseniya", sample_rate=24000,
                                     put_accent=True, put_stress_homo=True, put_yo=True, put_yo_homo=True)
        samples = result.detach().cpu().float().numpy()
        if samples.ndim != 1 or not np.isfinite(samples).all() or len(samples) < 2400:
            raise ValueError("Invalid waveform: " + cue_id)
        peak = float(np.max(np.abs(samples)))
        voiced = int(np.sum(np.abs(samples) > .002))
        if peak < .01 or voiced < 500:
            raise ValueError("Silent narration: " + cue_id)
        if peak > .90:
            samples = samples * (.90 / peak)
        speech_duration = len(samples) / 24000
        target_samples = max(len(samples), math.ceil(minimum * 24000))
        if len(samples) < target_samples:
            samples = np.pad(samples, (0, target_samples - len(samples)))
        temporary = audio_file.with_suffix(".tmp.mp3")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-threads", "1",
                        "-f", "f32le", "-ar", "24000", "-ac", "1", "-i", "pipe:0",
                        "-codec:a", "libmp3lame", "-q:a", "3", "-ar", "24000", "-ac", "1",
                        "-map_metadata", "-1", str(temporary)], input=samples.astype("<f4").tobytes(), check=True)
        temporary.replace(audio_file)
        probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", str(audio_file)], text=True))
        duration = float(probe["format"]["duration"])
        decoded = np.frombuffer(subprocess.check_output(["ffmpeg", "-nostdin", "-v", "error", "-i", str(audio_file), "-f", "f32le", "-ac", "1", "-ar", "24000", "pipe:1"]), dtype="<f4")
        if duration + .03 < minimum or not np.isfinite(decoded).all() or np.max(np.abs(decoded)) > 1:
            raise ValueError("Encoded clip failed verification: " + cue_id)
        metadata = {"id": cue_id, "src": "audio/coach/" + audio_file.name, "text": text,
                    "speech": speech, "duration": round(duration, 6), "minDuration": minimum,
                    "speechDuration": round(speech_duration, 6), "bytes": audio_file.stat().st_size,
                    "sha256": hashlib.sha256(audio_file.read_bytes()).hexdigest(),
                    "decodedPeak": round(float(np.max(np.abs(decoded))), 6), "fingerprint": fingerprint}
        metadata_file.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
        clips[cue_id] = metadata
        print(json.dumps({"done": number + 1, "total": len(cues), "id": cue_id,
                          "seconds": metadata["duration"], "bytes": metadata["bytes"]}), flush=True)
    if len(clips) == len(cues):
        manifest = {"version": 1, "voice": {"speaker": "kseniya", "model": "Silero v5_6_ru", "synthesized": True,
                     "license": "CC BY-NC-SA 4.0", "credits": "audio/coach/credits.txt"}, "clips": clips}
        (ROOT / "coach-audio-manifest.js").write_text("(function(root){'use strict';root.CoachAudioManifest=" + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";})(typeof window==='undefined'?globalThis:window);\n")
        summary = {"success": True, "clips": len(clips), "seconds": round(sum(c["duration"] for c in clips.values()), 3),
                   "bytes": sum(c["bytes"] for c in clips.values()), "elapsedSeconds": round(time.monotonic() - started, 3),
                   "modelSHA256": hashlib.sha256(Path(options.model).read_bytes()).hexdigest(), "settings": SETTINGS}
        (target / "generation-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(summary), flush=True)


if __name__ == "__main__":
    main()
