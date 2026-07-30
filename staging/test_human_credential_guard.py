import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HUMAN_USER = "williamvnvn@gmail.com"
EXECUTABLE_SUFFIXES = {".py", ".sh", ".yml", ".yaml"}


class HumanCredentialGuardTest(unittest.TestCase):
    def test_no_password_reset_command_targets_human_user(self):
        violations = []
        reset_pattern = re.compile(r"set-password|/reset-password", re.IGNORECASE)
        for base in (ROOT / "staging", ROOT / "apps"):
            for path in base.rglob("*"):
                if not path.is_file() or path.suffix not in EXECUTABLE_SUFFIXES:
                    continue
                if path.resolve() == Path(__file__).resolve():
                    continue
                text = path.read_text(encoding="utf-8", errors="ignore")
                if HUMAN_USER in text.casefold() and reset_pattern.search(text):
                    violations.append(str(path.relative_to(ROOT)))
        self.assertEqual([], violations, f"Automação tenta redefinir usuário humano: {violations}")

    def test_external_gates_reject_human_user(self):
        gates = sorted((ROOT / "staging").glob("*gate.py"))
        self.assertTrue(gates)
        for gate in gates:
            text = gate.read_text(encoding="utf-8", errors="ignore")
            if "WINS_HUB_GATE_USER" in text:
                self.assertIn("Usuários humanos não podem ser usados", text, gate.name)


if __name__ == "__main__":
    unittest.main()
