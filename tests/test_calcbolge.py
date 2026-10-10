from __future__ import annotations

import contextlib
import io
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import calcbolge as cb  # noqa: E402


class PositionalCodecTests(unittest.TestCase):
    def test_roundtrip_for_every_instruction_at_every_classic_position(self):
        for position in range(cb.MEM_SIZE):
            for opcode in cb.OPS:
                character = cb.char_for(opcode, position)
                self.assertTrue(33 <= ord(character) <= 126)
                self.assertEqual(cb.opcode_at(character, position), opcode)

    def test_printable_wrap_boundaries(self):
        self.assertEqual(cb.char_for(0, 0), "^")
        self.assertEqual(cb.char_for(32, 0), "~")
        self.assertEqual(cb.char_for(33, 0), "!")
        self.assertEqual(cb.char_for(93, 0), "]")

    def test_same_phase_repeats_every_94_cells(self):
        for position in (0, 17, 93, cb.MEM_SIZE - 95):
            for opcode in cb.OPS:
                self.assertEqual(
                    cb.char_for(opcode, position),
                    cb.char_for(opcode, position + cb.ALPHABET),
                )

    def test_coordinate_decomposition_and_classic_boundary(self):
        self.assertEqual(cb.coordinates(0), (0, 0))
        self.assertEqual(cb.coordinates(29515), (93, 313))
        self.assertEqual(cb.coordinates(29516), (0, 314))
        self.assertEqual(cb.coordinates(59048), (16, 628))
        with self.assertRaises(ValueError):
            cb.coordinates(-1)
        with self.assertRaises(ValueError):
            cb.coordinates(cb.MEM_SIZE)

    def test_coordinate_command_encodes_using_remainder_only(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            cb.cmd_coordinates(["29515", "nop"])
        text = output.getvalue()
        self.assertIn("(u=93, v=313)", text)
        self.assertIn("v does not enter", text)
        self.assertIn("ASCII 69 -> 'E'", text)
        self.assertIn("628 positions", text)

    def test_command_rejects_out_of_range_positions_and_multichar_input(self):
        with self.assertRaises(SystemExit):
            cb.cmd_encode(["nop", str(cb.MEM_SIZE)])
        with self.assertRaises(SystemExit):
            cb.cmd_decode(["abc", "0"])
        with self.assertRaises(SystemExit):
            cb.cmd_coordinates([str(cb.MEM_SIZE)])

    def test_writer_rejects_repeats_and_spans_past_classic_memory(self):
        with self.assertRaises(SystemExit):
            cb.cmd_asm(["nop*0"])
        with self.assertRaises(SystemExit):
            cb.cmd_ramp(["nop", str(cb.LAST), "2"])
        with self.assertRaises(SystemExit):
            cb.cmd_table([str(cb.LAST), "2"])
        with self.assertRaises(SystemExit):
            cb.cmd_coordinates(["not-a-position"])

    def test_cli_rejects_unknown_commands_and_extra_arguments(self):
        with self.assertRaises(SystemExit):
            cb.main(["calcbolge.py", "not-a-command"])
        with self.assertRaises(SystemExit):
            cb.main(["calcbolge.py", "selftest", "extra"])

    def test_ternary_operations_reject_non_words(self):
        with self.assertRaises(ValueError):
            cb.rotate(-1)
        with self.assertRaises(ValueError):
            cb.crazy(cb.MEM_SIZE, 0)


class SelfTestTests(unittest.TestCase):
    def test_selftest_is_independent_of_the_calling_directory(self):
        with tempfile.TemporaryDirectory() as cwd:
            result = subprocess.run(
                [sys.executable, str(ROOT / "calcbolge.py"), "selftest"],
                cwd=cwd,
                check=False,
                capture_output=True,
                text=True,
                timeout=60,
            )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Lutter opening vector: PASS", result.stdout)
        self.assertIn("SELFTEST=PASS", result.stdout)
        if "Lutter quine:" in result.stdout:
            self.assertIn("cell 0 is jmp: PASS", result.stdout)


if __name__ == "__main__":
    unittest.main()
