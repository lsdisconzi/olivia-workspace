import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.render_transcript import find_full_narrative_link


ROOT = Path(__file__).resolve().parents[1]


class NetifyBundleTests(unittest.TestCase):
    def test_build_netify_bundle_generates_drop_in_static_site(self):
        input_dir = ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "I-002"
        violation_dir = ROOT / "_shared" / "cases" / "la8159" / "01-violations" / "_json"
        tmp_root = ROOT / ".tmp_test_outputs"
        tmp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="netify_bundle_", dir=str(tmp_root)) as tmp_dir:
            output_dir = Path(tmp_dir) / "netify-ready"
            script = ROOT / "scripts" / "build_netify_bundle.py"

            self.assertTrue(script.exists(), f"Missing script: {script}")

            cmd = [
                sys.executable,
                str(script),
                "--input-dir",
                str(input_dir),
                "--output-dir",
                str(output_dir),
                "--violation-dir",
                str(violation_dir),
            ]
            subprocess.run(cmd, cwd=str(ROOT), check=True)

            index_file = output_dir / "index.html"
            self.assertTrue(index_file.exists(), "index.html was not created")

            rendered_dir = output_dir / "transcripts"
            rendered_files = list(rendered_dir.glob("*.html"))
            self.assertTrue(rendered_files, "No rendered transcript HTML files were created")

            sample_html = rendered_files[0].read_text(encoding="utf-8")
            self.assertIn("Disconzi v. LATAM", sample_html)

            audio_dir = output_dir / "audio"
            self.assertTrue(audio_dir.exists(), "audio directory was not created")

            # Check for at least one copied audio segment file
            self.assertTrue(any(audio_dir.rglob("*.wav")), "No WAV segment files were copied")

            for html_path in rendered_dir.glob("*.html"):
                html_text = html_path.read_text(encoding="utf-8")
                self.assertNotIn("/case_files/02-transcripts/transcripts_rendered/audio_player.js", html_text)
                self.assertNotIn("/case_files/02-transcripts/transcripts_rendered/audio_map.json", html_text)
                self.assertNotIn("/get_notes?stem=", html_text)

            audio_map_data = json.loads((output_dir / "audio_map.json").read_text(encoding="utf-8"))
            for key, value in audio_map_data.items():
                queue = []
                if isinstance(value, dict):
                    queue = list(value.values())
                elif isinstance(value, list):
                    queue = value
                else:
                    queue = [value]
                for item in queue:
                    if isinstance(item, (dict, list)):
                        for nested_item in (item.values() if isinstance(item, dict) else item):
                            self.assertFalse(str(nested_item).startswith("/"), f"Absolute path in {key}: {nested_item}")
                    else:
                        self.assertFalse(str(item).startswith("/"), f"Absolute path in {key}: {item}")

            self.assertTrue(True)

            index_file = output_dir / "index.html"
            self.assertTrue(index_file.exists(), "index.html was not created")

            rendered_dir = output_dir / "transcripts"
            rendered_files = list(rendered_dir.glob("*.html"))
            self.assertTrue(rendered_files, "No rendered transcript HTML files were created")

            sample_html = rendered_files[0].read_text(encoding="utf-8")
            self.assertIn("Disconzi v. LATAM", sample_html)

            audio_dir = output_dir / "audio"
            self.assertTrue(audio_dir.exists(), "audio directory was not created")

            # Check for at least one copied audio segment file
            self.assertTrue(any(audio_dir.rglob("*.wav")), "No WAV segment files were copied")

    def test_bundle_uses_bundle_relative_assets(self):
        input_dir = ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "I-002"
        violation_dir = ROOT / "_shared" / "cases" / "la8159" / "01-violations" / "_json"
        tmp_root = ROOT / ".tmp_test_outputs"
        tmp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="netify_bundle_rel_", dir=str(tmp_root)) as tmp_dir:
            output_dir = Path(tmp_dir) / "netify-ready"
            script = ROOT / "scripts" / "build_netify_bundle.py"

            subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "--input-dir",
                    str(input_dir),
                    "--output-dir",
                    str(output_dir),
                    "--violation-dir",
                    str(violation_dir),
                ],
                cwd=str(ROOT),
                check=True,
            )

            for html_path in (output_dir / "transcripts").glob("*.html"):
                html_text = html_path.read_text(encoding="utf-8")
                self.assertNotIn("/case_files/02-transcripts/transcripts_rendered/audio_player.js", html_text)
                self.assertNotIn("/case_files/02-transcripts/transcripts_rendered/audio_map.json", html_text)
                self.assertNotIn("/get_notes?stem=", html_text)

            audio_map_data = json.loads((output_dir / "audio_map.json").read_text(encoding="utf-8"))
            for key, value in audio_map_data.items():
                queue = []
                if isinstance(value, dict):
                    queue = list(value.values())
                elif isinstance(value, list):
                    queue = value
                else:
                    queue = [value]
                for item in queue:
                    if isinstance(item, (dict, list)):
                        for nested_item in (item.values() if isinstance(item, dict) else item):
                            self.assertFalse(str(nested_item).startswith("/"), f"Absolute path in {key}: {nested_item}")
                    else:
                        self.assertFalse(str(item).startswith("/"), f"Absolute path in {key}: {item}")

    def test_full_narrative_link_points_to_live_rendered_case_file(self):
        input_dir = ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "I-002"
        rendered_dir = ROOT / "_shared" / "cases" / "la8159" / "02-transcripts" / "transcripts_rendered" / "I-002"

        for transcript_name in [
            "I-002_02_NAR-02_STG_2_boarding_gate.json",
            "I-002_06_NAR-STG_8_pdi_identity_control.json",
            "I-002_11_NAR-14_Terminal_Internacional_T2_counter.json",
        ]:
            transcript_path = input_dir / transcript_name
            with transcript_path.open("r", encoding="utf-8") as handle:
                transcript_data = json.load(handle)

            link = find_full_narrative_link(transcript_data, rendered_dir)
            self.assertNotEqual(link, "../index.html", f"Narrative lookup should resolve to a live Full Narrative page for {transcript_name}")
            self.assertTrue((rendered_dir / link.split("/")[-1]).exists(), f"Missing narrative target: {link}")


if __name__ == "__main__":
    unittest.main()
