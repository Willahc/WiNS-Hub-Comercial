from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from . import PIPELINE_VERSION
from .pipeline import Metrics, Outcome, process, sanitized
from .repository import PostgresRepository, connect
from .sources import SOURCES

BRT = ZoneInfo("America/Sao_Paulo")
LOCK_ID = 867530901
MIN_FREE_BYTES = 15_000_000_000


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
        }, ensure_ascii=False)


def configure_logging(log_dir: str) -> logging.Logger:
    path = Path(log_dir)
    path.mkdir(parents=True, exist_ok=True, mode=0o750)
    logger = logging.getLogger("engineering_capture")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    formatter = JsonFormatter()
    stream = logging.StreamHandler()
    stream.setFormatter(formatter)
    file_handler = logging.FileHandler(path / f"capture-{datetime.now(BRT):%Y-%m-%d}.jsonl")
    file_handler.setFormatter(formatter)
    logger.addHandler(stream)
    logger.addHandler(file_handler)
    return logger


def disk_safe(path: str = "/") -> tuple[bool, int]:
    free = shutil.disk_usage(path).free
    return free >= int(os.getenv("ENGINEERING_CAPTURE_MIN_FREE_BYTES", MIN_FREE_BYTES)), free


def run(*, dry_run: bool, days: int, max_pages: int, log_dir: str) -> tuple[int, dict]:
    logger = configure_logging(log_dir)
    run_id = str(uuid.uuid4())
    scheduled_for = datetime.now(BRT)
    metrics = Metrics()
    samples: dict[str, dict] = {}
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_ID,))
            if not cur.fetchone()[0]:
                logger.warning(json.dumps({"run_id": run_id, "status": "SKIPPED_LOCKED"}))
                return 0, {"run_id": run_id, "status": "SKIPPED_LOCKED"}
            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO engenharia.engineering_capture_runs (
                        run_id, scheduled_for, started_at, timezone, status,
                        sources_total, pipeline_version, dry_run
                    ) VALUES (%s,%s,now(),'America/Sao_Paulo','RUNNING',%s,%s,false)
                    """,
                    (run_id, scheduled_for, len(SOURCES), PIPELINE_VERSION),
                )
                conn.commit()
        safe, free = disk_safe()
        if not dry_run and not safe:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE engenharia.engineering_capture_runs
                       SET status='BLOCKED_DISK', finished_at=now(),
                           error_summary=%s
                     WHERE run_id=%s
                    """,
                    (f"free_bytes={free}", run_id),
                )
            conn.commit()
            logger.error(json.dumps({
                "run_id": run_id, "status": "BLOCKED_DISK", "free_bytes": free,
            }))
            return 2, {"run_id": run_id, "status": "BLOCKED_DISK", "free_bytes": free}
        repo = PostgresRepository(conn, run_id=run_id)
        source_results = []
        for source_class in SOURCES:
            source = source_class()
            source_metrics = Metrics()
            source_started = datetime.now(timezone.utc)
            status = "SUCCESS"
            error = None
            try:
                for raw in source.capture(days=days, max_pages=max_pages):
                    metrics.captured_count += 1
                    source_metrics.captured_count += 1
                    decision = process(raw, repo, dry_run=dry_run)
                    metrics.record(decision)
                    source_metrics.record(decision)
                    samples.setdefault(decision.outcome.value, {
                        "decision": decision.outcome.value,
                        **sanitized(decision.candidate),
                    })
            except Exception as exc:
                conn.rollback()
                status = "FAILED"
                error = str(exc)[:300]
                metrics.errors += 1
                logger.error(json.dumps({
                    "run_id": run_id, "captador": source.name,
                    "status": status, "error": error,
                }))
            metrics.retries += source.retries
            source_metrics.retries += source.retries
            source_results.append({
                "captador": source.name, "status": status, "error": error,
                **asdict(source_metrics),
            })
            if not dry_run:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO engenharia.engineering_capture_source_runs (
                            run_id, source, started_at, finished_at, status,
                            captured_count, inserted_count, updated_count,
                            unchanged_count, duplicate_count, conflict_count,
                            rejected_count, retry_count, error_summary, checkpoint
                        ) VALUES (%s,%s,%s,now(),%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (run_id, source) DO UPDATE SET
                            finished_at=EXCLUDED.finished_at,
                            status=EXCLUDED.status,
                            captured_count=EXCLUDED.captured_count,
                            inserted_count=EXCLUDED.inserted_count,
                            updated_count=EXCLUDED.updated_count,
                            unchanged_count=EXCLUDED.unchanged_count,
                            duplicate_count=EXCLUDED.duplicate_count,
                            conflict_count=EXCLUDED.conflict_count,
                            rejected_count=EXCLUDED.rejected_count,
                            retry_count=EXCLUDED.retry_count,
                            error_summary=EXCLUDED.error_summary,
                            checkpoint=EXCLUDED.checkpoint
                        """,
                        (
                            run_id, source.name, source_started, status,
                            source_metrics.captured_count, source_metrics.inserted_count,
                            source_metrics.updated_count, source_metrics.unchanged_count,
                            source_metrics.duplicate_count, source_metrics.conflict_count,
                            source_metrics.rejected_below_minimum
                            + source_metrics.rejected_missing_value
                            + source_metrics.rejected_out_of_scope,
                            source_metrics.retries, error,
                            json.dumps({"days": days, "max_pages": max_pages}),
                        ),
                    )
                conn.commit()
        if dry_run:
            conn.rollback()
        else:
            success_count = sum(x["status"] == "SUCCESS" for x in source_results)
            failure_count = len(source_results) - success_count
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE engenharia.engineering_capture_runs SET
                        finished_at=now(), status=%s, sources_success=%s,
                        sources_failed=%s, captured_count=%s, civil_count=%s,
                        industrial_count=%s, rejected_below_minimum=%s,
                        rejected_missing_value=%s, rejected_out_of_scope=%s,
                        inserted_count=%s, updated_count=%s, unchanged_count=%s,
                        duplicate_count=%s, conflict_count=%s, error_summary=%s
                    WHERE run_id=%s
                    """,
                    (
                        "SUCCESS" if failure_count == 0 else ("PARTIAL_SUCCESS" if success_count else "FAILED"),
                        success_count, failure_count, metrics.captured_count,
                        metrics.civil_count, metrics.industrial_count,
                        metrics.rejected_below_minimum, metrics.rejected_missing_value,
                        metrics.rejected_out_of_scope, metrics.inserted_count,
                        metrics.updated_count, metrics.unchanged_count,
                        metrics.duplicate_count, metrics.conflict_count,
                        "; ".join(x["error"] for x in source_results if x["error"])[:1000] or None,
                        run_id,
                    ),
                )
            conn.commit()
        success_count = sum(x["status"] == "SUCCESS" for x in source_results)
        final_status = (
            "SUCCESS" if success_count == len(source_results)
            else ("PARTIAL_SUCCESS" if success_count else "FAILED")
        )
        report = {
            "run_id": run_id, "scheduled_for": scheduled_for.isoformat(),
            "timezone": "America/Sao_Paulo", "status": final_status,
            "dry_run": dry_run, "pipeline_version": PIPELINE_VERSION,
            "sources": source_results, "metrics": asdict(metrics), "samples": samples,
        }
        logger.info(json.dumps(report, ensure_ascii=False))
        return (0 if final_status == "SUCCESS" else 1), report
    finally:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(%s)", (LOCK_ID,))
        finally:
            conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--days", type=int, default=3)
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--log-dir", default="/var/log/winshub/engineering-capture")
    args = parser.parse_args()
    code, _ = run(
        dry_run=args.dry_run, days=max(1, args.days),
        max_pages=max(1, args.max_pages), log_dir=args.log_dir,
    )
    return code


if __name__ == "__main__":
    raise SystemExit(main())
