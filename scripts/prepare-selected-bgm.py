"""Package the user-selected masters without changing their samples or tempo."""
from pathlib import Path
import hashlib
import json
import subprocess
import wave
from datetime import datetime, timezone

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/assets/audio"
REPORT = ROOT / "artifacts/bgm-integration-20261005"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pack(name, relative):
    source = ROOT / relative
    with wave.open(str(source), "rb") as wav:
        pcm = wav.readframes(wav.getnframes())
        info = dict(sample_rate=wav.getframerate(), channels=wav.getnchannels(),
                    frames=wav.getnframes(), seconds=wav.getnframes() / wav.getframerate())
        assert wav.getsampwidth() == 2, "Expected approved PCM16 master"
    flac = DEST / (name + ".flac")
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                    "-map", "0:a:0", "-c:a", "flac", "-compression_level", "8", str(flac)], check=True)
    decoded = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", str(flac),
                              "-f", "s16le", "-c:a", "pcm_s16le", "-"],
                             check=True, stdout=subprocess.PIPE).stdout
    assert decoded == pcm, "Runtime FLAC changed approved master samples"
    mp3 = DEST / (name + ".mp3")
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                    "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], check=True)
    return dict(master=relative, master_sha256=digest(source), **info,
                flac=dict(file=flac.name, sha256=digest(flac), bytes=flac.stat().st_size,
                          pcm_equal_to_master=True),
                fallback=dict(file=mp3.name, sha256=digest(mp3), bytes=mp3.stat().st_size,
                              note="192kbps MP3 encoded from the approved PCM; browser loop timing checked separately"))


DEST.mkdir(parents=True, exist_ok=True)
REPORT.mkdir(parents=True, exist_ok=True)
pieces = {
    "daily": pack("b-velvet-gambit-loop", "artifacts/bgm-table-candidates-20261004/loops/b-velvet-gambit-loop.wav"),
    "allin": pack("c2-no-way-back-loop", "artifacts/bgm-scene-v2-20261005/loops/c-no-way-back-v2-loop.wav"),
    "endgameOnce": pack("d5-final-writ-once", "artifacts/bgm-endgame-d5-20261005/audio/d5-endgame-opening-and-entry-once.wav"),
    "endgameLoop": pack("d5-final-writ-loop", "artifacts/bgm-endgame-d5-20261005/loops/d5-final-writ-loop.wav"),
}
now = datetime.now(timezone.utc).isoformat()
tracks = {
    "daily": dict(version="B", title="暗金博弈 / Velvet Gambit", acceptance="approved_by_user",
                  flow_url="https://www.flowmusic.app/song/afbafb0b-da72-40c7-a225-278957752876",
                  record="artifacts/bgm-table-candidates-20261004/generation-record.json"),
    "allin": dict(version="C2", title="孤注一掷 / No Way Back", acceptance="provisionally_approved_by_user",
                  flow_url="https://www.flowmusic.app/song/8df6966e-1ac1-4ea9-92fe-67c054461a5f",
                  record="artifacts/bgm-scene-v2-20261005/generation-record.json"),
    "endgame": dict(version="D5", title="终局裁决 / Final Writ", acceptance="approved_by_user",
                    slow_opening_seconds=3.16, once_seconds=pieces["endgameOnce"]["seconds"],
                    fast_entry_seconds=9.776354166666666,
                    flow_url="https://www.flowmusic.app/song/544100d4-8cbc-4872-8ec6-55a3c6605067",
                    method="Flow Remix > Replace of D4 opening 0:00-0:40; source-contiguous first handoff; no time stretch",
                    record="artifacts/bgm-endgame-d5-20261005/generation-record.json"),
}
provenance = dict(schema_version=1, packaged_at_utc=now, tracks=tracks, pieces=pieces,
                  processing="Lossless encoding only; approved gain, loop edits and tempo preserved",
                  direct_listening_by_agent=False)
(DEST / "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(REPORT / "runtime-assets.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Keep historical generation records, adding the actual human selection.
for rel, selected in [(tracks["daily"]["record"], "B"), (tracks["allin"]["record"], "C2"),
                      (tracks["endgame"]["record"], "D5")]:
    path = ROOT / rel
    record = json.loads(path.read_text(encoding="utf-8-sig"))
    selection = dict(version=selected, selected_for_game=True, at_utc=now,
                     approval="provisional" if selected == "C2" else "approved",
                     evidence="User requested integrating all selected BGM after accepting D5")
    record["runtime_selection"] = selection
    if selected == "B":
        next(t for t in record["tracks"] if t["candidate"] == "B")["user_review"] = selection
        record["acceptance"]["user_audition"] = "B approved for daily table use; A preserved as comparison"
    elif selected == "D5":
        record["status"] = "approved_by_user_selected_for_game"
        record["acceptance"]["user_audition"] = "approved_by_user"
        record["selection"]["D5"] = "approved_by_user_selected_for_game"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"pieces": len(pieces), "all_lossless_pcm_equal": True,
                  "flac_bytes": sum(p["flac"]["bytes"] for p in pieces.values()),
                  "total_runtime_bytes": sum(p["flac"]["bytes"] + p["fallback"]["bytes"] for p in pieces.values())}))
