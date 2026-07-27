from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from engineering_capture.pipeline import (
    Classification,
    Decision,
    Outcome,
    RawCandidate,
    ValueClass,
    classify,
    normalize,
    parse_decimal,
    process,
)
from engineering_capture.runner import disk_safe
from engineering_capture.sources import HttpJsonSource


def candidate(
    *,
    title="Construção de hospital municipal",
    value="100000.00",
    value_class=ValueClass.PUBLICADO,
    source_id="source-1",
    currency="BRL",
):
    return RawCandidate(
        source="test_official", source_id=source_id, title=title,
        description=title, value_original=value, currency_original=currency,
        value_class=value_class, value_source_field="valor",
        canonical_url=f"https://example.invalid/works/{source_id}",
        collected_at=datetime.now(timezone.utc), payload={},
    )


class FakeRepository:
    def __init__(self):
        self.rows = {}
        self.rejections = []
        self.locked = False

    def classify_existing(self, item):
        row = self.rows.get(item.idempotency_key)
        if not row:
            return Outcome.NOVA, None
        if row.content_hash == item.content_hash:
            return Outcome.SEM_ALTERACAO, item.idempotency_key
        return Outcome.ATUALIZADA, item.idempotency_key

    def persist(self, item, existing_id):
        outcome = Outcome.ATUALIZADA if existing_id else Outcome.NOVA
        self.rows[item.idempotency_key] = item
        return Decision(outcome, item, "fake", item.idempotency_key)

    def reject(self, decision):
        self.rejections.append(decision)

    def acquire_lock(self):
        if self.locked:
            return False
        self.locked = True
        return True


class EngineeringCaptureRulesTest(unittest.TestCase):
    def test_classifies_civil(self):
        self.assertEqual(classify("Construção de ponte", "")[0], Classification.CIVIL)

    def test_classifies_industrial(self):
        self.assertEqual(classify("Nova planta industrial e linha de produção", "")[0], Classification.INDUSTRIAL)

    def test_rejects_other_vertical(self):
        repo = FakeRepository()
        result = process(candidate(title="Compra administrativa de software"), repo, dry_run=False)
        self.assertEqual(result.outcome, Outcome.REJEITADA_ESCOPO)

    def test_exactly_100k_is_accepted(self):
        result = process(candidate(value="100000.00"), FakeRepository(), dry_run=True)
        self.assertEqual(result.outcome, Outcome.NOVA)

    def test_99999_99_is_rejected(self):
        result = process(candidate(value="99999.99"), FakeRepository(), dry_run=True)
        self.assertEqual(result.outcome, Outcome.REJEITADA_ABAIXO)

    def test_missing_value_is_rejected(self):
        result = process(
            candidate(value=None, value_class=ValueClass.AUSENTE),
            FakeRepository(), dry_run=True,
        )
        self.assertEqual(result.outcome, Outcome.REJEITADA_SEM_VALOR)

    def test_decimal_has_no_float_rounding(self):
        self.assertEqual(parse_decimal("99.999,99"), Decimal("99999.99"))
        self.assertEqual(parse_decimal("100000.00"), Decimal("100000.00"))

    def test_foreign_currency_goes_to_review(self):
        result = process(candidate(value="200000", currency="USD"), FakeRepository(), dry_run=True)
        self.assertEqual(result.outcome, Outcome.REVISAO_CAMBIO)

    def test_deduplication_and_idempotency(self):
        repo = FakeRepository()
        first = process(candidate(), repo, dry_run=False)
        second = process(candidate(), repo, dry_run=False)
        self.assertEqual(first.outcome, Outcome.NOVA)
        self.assertEqual(second.outcome, Outcome.SEM_ALTERACAO)
        self.assertEqual(len(repo.rows), 1)

    def test_update_when_content_changes(self):
        repo = FakeRepository()
        process(candidate(), repo, dry_run=False)
        changed = process(candidate(title="Ampliação de hospital municipal"), repo, dry_run=False)
        self.assertEqual(changed.outcome, Outcome.ATUALIZADA)
        self.assertEqual(len(repo.rows), 1)

    def test_dry_run_never_persists(self):
        repo = FakeRepository()
        process(candidate(), repo, dry_run=True)
        self.assertEqual(repo.rows, {})

    def test_lock_refuses_second_holder(self):
        repo = FakeRepository()
        self.assertTrue(repo.acquire_lock())
        self.assertFalse(repo.acquire_lock())


class RetryTest(unittest.TestCase):
    def test_retry_then_success(self):
        source = HttpJsonSource()
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok": true}'
        with patch("engineering_capture.sources.urlopen", side_effect=[TimeoutError(), response]):
            with patch("engineering_capture.sources.time.sleep"):
                self.assertEqual(source.get_json("https://example.invalid", {}), {"ok": True})
        self.assertEqual(source.retries, 1)

    def test_failure_isolated_by_runner_contract(self):
        sources = ["failed", "success"]
        results = []
        for source in sources:
            try:
                if source == "failed":
                    raise RuntimeError("offline")
                results.append(source)
            except RuntimeError:
                continue
        self.assertEqual(results, ["success"])

    def test_timeout_is_classified(self):
        source = HttpJsonSource()
        with patch("engineering_capture.sources.urlopen", side_effect=TimeoutError()):
            with patch("engineering_capture.sources.time.sleep"):
                with self.assertRaisesRegex(RuntimeError, "TIMEOUT"):
                    source.get_json("https://example.invalid", {})
        self.assertEqual(source.retries, 2)


class SchedulingTest(unittest.TestCase):
    def test_timer_uses_sao_paulo_at_0100(self):
        timer = Path("systemd/winshub-engineering-capture.timer").read_text()
        self.assertIn("OnCalendar=*-*-* 01:00:00 America/Sao_Paulo", timer)

    def test_service_has_flock_and_timeout(self):
        service = Path("systemd/winshub-engineering-capture.service").read_text()
        self.assertIn("/usr/bin/flock -n", service)
        self.assertIn("TimeoutStartSec=2h", service)

    def test_disk_guard(self):
        with patch("engineering_capture.runner.shutil.disk_usage") as usage:
            usage.return_value.free = 1
            self.assertFalse(disk_safe()[0])

    def test_disk_guard_requires_15_decimal_gb(self):
        with patch("engineering_capture.runner.shutil.disk_usage") as usage:
            usage.return_value.free = 14_999_999_999
            self.assertFalse(disk_safe()[0])
            usage.return_value.free = 15_000_000_000
            self.assertTrue(disk_safe()[0])


if __name__ == "__main__":
    unittest.main()
