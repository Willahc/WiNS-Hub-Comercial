from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[2] / "scripts" / "test_pncp_commercial_leads.py"
SPEC = importlib.util.spec_from_file_location("pncp_commercial_leads", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class PncpCommercialLeadTest(unittest.TestCase):
    def test_validates_cnpj_check_digits(self):
        self.assertTrue(MODULE.valid_cnpj("05.502.281/0001-02"))
        self.assertTrue(MODULE.valid_cnpj("72.183.486/0001-51"))
        self.assertFalse(MODULE.valid_cnpj("05.502.281/0001-03"))
        self.assertFalse(MODULE.valid_cnpj("00.000.000/0000-00"))

    def test_accepts_company_domain_match(self):
        self.assertTrue(
            MODULE.domain_matches_company(
                "ellenco.com.br", "ELLENCO CONSTRUCOES LTDA"
            )
        )
        self.assertFalse(
            MODULE.domain_matches_company(
                "contadoronline.com.br", "ELLENCO CONSTRUCOES LTDA"
            )
        )

    def test_rejects_public_and_directory_domains(self):
        self.assertIsNone(MODULE.registrable_domain("https://empresa.gov.br/x"))
        self.assertIsNone(
            MODULE.registrable_domain("https://www.econodata.com.br/empresa/x")
        )


if __name__ == "__main__":
    unittest.main()
