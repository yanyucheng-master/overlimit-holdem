"""Package L1 and append provenance, preserving every existing table master."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import wave

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "artifacts/bgm-lobby-20261007"
DEST = ROOT / "public/assets/audio"
SOURCE = ARCHIVE / "loops/l1-before-the-deal-loop.wav"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest_path = DEST / "provenance.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    protected = {p.name: digest(p) for p in DEST.iterdir()
                 if p.suffix in (".flac", ".mp3") and not p.name.startswith("l1-")}
    with wave.open(str(SOURCE), "rb") as source:
        assert source.getsampwidth() == 2
        pcm = source.readframes(source.getnframes())
        info = dict(sample_rate=source.getframerate(), channels=source.getnchannels(),
                    frames=source.getnframes(), seconds=source.getnframes() / source.getframerate())
    files = {}
    for format, codec in [("flac", ["-c:a", "flac", "-compression_level", "8"]),
                          ("mp3", ["-c:a", "libmp3lame", "-b:a", "192k"])]:
        path = DEST / ("l1-before-the-deal-loop." + format)
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(SOURCE),
                        "-map", "0:a:0", *codec, str(path)], check=True)
        files[format] = dict(file=path.name, sha256=digest(path), bytes=path.stat().st_size)
    decoded = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i",
                              str(DEST / files["flac"]["file"]), "-f", "s16le", "-c:a", "pcm_s16le", "-"],
                             check=True, stdout=subprocess.PIPE).stdout
    assert decoded == pcm, "Runtime FLAC must preserve all loop master samples"
    assert all(digest(DEST / name) == sha for name, sha in protected.items()), "Table assets changed"
    files["flac"]["pcm_equal_to_master"] = True
    files["mp3"]["note"] = "192kbps compatibility encoding; browser sample counts checked separately"
    processing = json.loads((ARCHIVE / "reports/l1-before-the-deal-processing.json").read_text(encoding="utf-8"))
    manifest["tracks"]["lobby"] = dict(version="L1", title="入席之前 / Before the Deal",
        acceptance="integrated_pending_user_audition", flow_url="https://www.flowmusic.app/song/a7139029-4759-4b1d-a4be-e4c1fa45198c",
        record="artifacts/bgm-lobby-20261007/generation-record.json", requested_bpm=100,
        estimated_bpm=102.0011480066757, screens=["auth", "wait", "skillLab"],
        processing=dict(start_seconds=processing["selected_start_seconds"], end_seconds=processing["selected_end_seconds"],
                        overlap_seconds=processing["overlap_seconds"], gain_db=processing["gain_db"],
                        target_lufs=processing["target_lufs"], tempo_changed=False,
                        method=processing["method"]))
    manifest["pieces"]["lobby"] = dict(master=SOURCE.relative_to(ROOT).as_posix(), master_sha256=digest(SOURCE),
        original= "artifacts/bgm-lobby-20261007/originals/l1-before-the-deal-original.wav",
        original_sha256=processing["source_sha256"], **info, flac=files["flac"], fallback=files["mp3"])
    manifest["updated_at_utc"] = datetime.now(timezone.utc).isoformat()
    manifest["processing"] = "Existing approved table masters preserved; lobby uses one-bar overlap and constant gain, then lossless/compatibility encoding; no tempo change"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ARCHIVE / "reports/runtime-assets.json").write_text(json.dumps(dict(piece=manifest["pieces"]["lobby"],
        previous_table_asset_hashes=protected, previous_table_assets_unchanged=True), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    record_path = ARCHIVE / "generation-record.json"
    record = json.loads(record_path.read_text(encoding="utf-8"))
    record.update(status="generated_processed_integrated_pending_user_audition",
        original_file=manifest["pieces"]["lobby"]["original"], original_sha256=processing["source_sha256"],
        download_filename="超限德州｜入席之前 Before the Deal｜大厅 L1.wav",
        processing=processing, runtime=manifest["pieces"]["lobby"])
    record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(dict(lobby_seconds=info["seconds"], flac_pcm_equal=True, table_assets_unchanged=True,
                          runtime_bytes=sum(f["bytes"] for f in files.values()))))


if __name__ == "__main__":
    main()
