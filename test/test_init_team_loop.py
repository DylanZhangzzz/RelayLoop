import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
INIT_SCRIPT = REPO_ROOT / "scripts" / "init_team_loop.py"


class RelayLoopProjectHarnessTests(unittest.TestCase):
    def run_init(self, project_path, *extra_args):
        return subprocess.run(
            [
                sys.executable,
                str(INIT_SCRIPT),
                "--project-name",
                "ExampleApp",
                "--project-path",
                str(project_path),
                *extra_args,
            ],
            cwd=REPO_ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def parse_stdout_json(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_dry_run_with_project_harness_creates_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)

            result = self.run_init(project, "--include-project-harness", "--dry-run")
            payload = self.parse_stdout_json(result)

            self.assertTrue(payload["projectHarness"]["enabled"])
            self.assertEqual(payload["projectHarness"]["mode"], "dry-run")
            self.assertGreater(payload["projectHarness"]["planned"], 0)
            self.assertFalse((project / "team-loop").exists())
            self.assertFalse((project / "AGENTS.md").exists())
            self.assertFalse((project / "specs").exists())
            self.assertFalse((project / ".gitignore").exists())

    def test_include_project_harness_creates_expected_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)

            result = self.run_init(project, "--include-project-harness")
            payload = self.parse_stdout_json(result)

            self.assertTrue(payload["projectHarness"]["enabled"])
            self.assertEqual(payload["projectHarness"]["mode"], "write")
            self.assertTrue((project / "team-loop" / "progress.md").exists())
            self.assertIn("AGENTS.md is a concise project map", (project / "AGENTS.md").read_text())
            self.assertIn("harness status: needs_grill_me_confirmation", (project / "AGENTS.md").read_text())
            self.assertIn("PM must grill Dylan", (project / "specs" / "project-spec.md").read_text())
            self.assertIn("project goal", (project / "specs" / "project-spec.md").read_text())
            self.assertIn("Required Evidence", (project / "specs" / "acceptance-criteria.md").read_text())
            self.assertIn("needs_grill_me_confirmation", (project / "specs" / "acceptance-criteria.md").read_text())
            self.assertTrue((project / "specs" / "modules" / ".gitkeep").exists())
            self.assertEqual((project / ".gitignore").read_text().count(".agent-runs/"), 1)

    def test_legacy_app_harness_alias_still_creates_project_harness(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)

            payload = self.parse_stdout_json(self.run_init(project, "--include-app-harness"))

            self.assertTrue(payload["projectHarness"]["enabled"])
            self.assertNotIn("appHarness", payload)
            self.assertTrue((project / "AGENTS.md").exists())

    def test_project_harness_guidance_is_added_to_generated_role_profiles(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)

            self.parse_stdout_json(self.run_init(project, "--include-project-harness"))
            profiles = project / "team-loop" / "agent-profiles"

            pm_profile = (profiles / "pm.md").read_text()
            dev_profile = (profiles / "dev.md").read_text()
            test_profile = (profiles / "test.md").read_text()
            review_profile = (profiles / "review.md").read_text()
            ux_profile = (profiles / "ux.md").read_text()

            self.assertIn("AGENTS.md", pm_profile)
            self.assertIn("specs/project-spec.md", pm_profile)
            self.assertIn("team-loop/progress.md", pm_profile)
            self.assertIn("RELAYLOOP_MESSAGE v1", pm_profile)
            self.assertIn("AGENTS.md", dev_profile)
            self.assertIn("specs/project-spec.md", dev_profile)
            self.assertIn("specs/acceptance-criteria.md", test_profile)
            self.assertIn("acceptance/evidence contract", test_profile)
            self.assertIn("approval boundaries", review_profile)
            self.assertIn("specs/project-spec.md", review_profile)
            self.assertIn("user scenarios", ux_profile)
            self.assertIn("UX acceptance requirements", ux_profile)

            protocol = (project / "team-loop" / "protocol.md").read_text()
            self.assertIn("RELAYLOOP_MESSAGE v1", protocol)
            self.assertNotIn(f"TEAM{'LOOP'}_MESSAGE v1", protocol)

    def test_default_run_does_not_create_project_harness_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)

            payload = self.parse_stdout_json(self.run_init(project))

            self.assertFalse(payload["projectHarness"]["enabled"])
            self.assertTrue((project / "team-loop").exists())
            self.assertFalse((project / "AGENTS.md").exists())
            self.assertFalse((project / "specs").exists())

    def test_existing_harness_files_are_preserved_without_force(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            agents = project / "AGENTS.md"
            spec = project / "specs" / "project-spec.md"
            spec.parent.mkdir()
            agents.write_text("existing agents\n")
            spec.write_text("existing spec\n")

            payload = self.parse_stdout_json(self.run_init(project, "--include-project-harness"))

            self.assertEqual(agents.read_text(), "existing agents\n")
            self.assertEqual(spec.read_text(), "existing spec\n")
            self.assertGreater(payload["projectHarness"]["skipped"], 0)

    def test_force_overwrites_existing_harness_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            agents = project / "AGENTS.md"
            spec = project / "specs" / "project-spec.md"
            spec.parent.mkdir()
            agents.write_text("existing agents\n")
            spec.write_text("existing spec\n")

            payload = self.parse_stdout_json(self.run_init(project, "--include-project-harness", "--force"))

            self.assertIn("AGENTS.md is a concise project map", agents.read_text())
            self.assertIn("PM must grill Dylan", spec.read_text())
            self.assertGreater(payload["projectHarness"]["written"], 0)

    def test_gitignore_agent_runs_entry_is_appended_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            gitignore = project / ".gitignore"
            gitignore.write_text("dist/\n.agent-runs/\n")

            self.parse_stdout_json(self.run_init(project, "--include-project-harness"))

            self.assertEqual(gitignore.read_text().count(".agent-runs/"), 1)

    def test_app_project_type_suggests_harness_without_writing_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)

            payload = self.parse_stdout_json(self.run_init(project, "--project-type", "app"))

            self.assertFalse(payload["projectHarness"]["enabled"])
            self.assertIn("--include-project-harness", payload["nextAction"])
            self.assertFalse((project / "AGENTS.md").exists())
            self.assertFalse((project / "specs").exists())


if __name__ == "__main__":
    unittest.main()
