from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import psycopg2
from psycopg2.extras import Json, RealDictCursor

from . import PIPELINE_VERSION
from .pipeline import Decision, NormalizedCandidate, Outcome, ValueClass

VALUE_STRENGTH = {
    ValueClass.AUSENTE.value: 0,
    ValueClass.ESTIMADO_MODELO.value: 1,
    ValueClass.ESTIMADO_REGRA.value: 2,
    ValueClass.PUBLICADO.value: 3,
    ValueClass.DOCUMENTAL.value: 4,
}


def connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "wins_agro"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
        connect_timeout=10,
        application_name="engineering_capture_v1",
        options="-c search_path=engenharia,public",
    )


class PostgresRepository:
    def __init__(self, conn, *, run_id: str):
        self.conn = conn
        self.run_id = run_id

    def classify_existing(self, candidate: NormalizedCandidate) -> tuple[Outcome, str | None]:
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id::text, engineering_content_hash
                  FROM engenharia.obras
                 WHERE (fonte = %s AND engineering_idempotency_key = %s)
                    OR id_externo = %s
                 ORDER BY (fonte = %s AND engineering_idempotency_key = %s) DESC
                 LIMIT 1
                """,
                (
                    candidate.source, candidate.idempotency_key, candidate.source_id,
                    candidate.source, candidate.idempotency_key,
                ),
            )
            row = cur.fetchone()
            if row:
                return (
                    Outcome.SEM_ALTERACAO
                    if row["engineering_content_hash"] == candidate.content_hash
                    else Outcome.ATUALIZADA,
                    row["id"],
                )
            if candidate.canonical_url:
                cur.execute(
                    """
                    SELECT id::text FROM engenharia.obras
                     WHERE url_fonte = %s
                       AND engenharia.immutable_unaccent_lower(nome) =
                           engenharia.immutable_unaccent_lower(%s)
                     LIMIT 2
                    """,
                    (candidate.canonical_url, candidate.title),
                )
                matches = cur.fetchall()
                if len(matches) == 1:
                    return Outcome.DUPLICATA, matches[0]["id"]
                if len(matches) > 1:
                    return Outcome.CONFLITO, None
        return Outcome.NOVA, None

    def _capture_raw(self, candidate: NormalizedCandidate) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, f.id
                  FROM engenharia.captadores c
                  JOIN engenharia.fontes f ON f.id = c.fonte_id
                 WHERE c.nome = %s AND f.nome_curto = %s
                 LIMIT 1
                """,
                (f"canonical_{candidate.source}", candidate.source),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f"fonte/captador não registrado: {candidate.source}")
            captor_id, source_id = row
            safe_payload = {
                "source_id": candidate.source_id,
                "title": candidate.title,
                "description": candidate.description,
                "value_original": str(candidate.value_original),
                "currency_original": candidate.currency_original,
                "value_class": candidate.value_class.value,
                "canonical_url": candidate.canonical_url,
                "collected_at": candidate.collected_at.isoformat(),
            }
            cur.execute(
                """
                INSERT INTO engenharia.capturas_brutas (
                    captador_id, fonte_id, payload, id_externo, url_origem,
                    hash_conteudo, versao_captador, status, metadados,
                    namespace, origem_marcador, campos_canonicos
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,'normalizado',%s,'engineering',%s,%s)
                ON CONFLICT DO NOTHING
                """,
                (
                    captor_id, source_id, Json(safe_payload), candidate.source_id,
                    candidate.canonical_url, candidate.content_hash, PIPELINE_VERSION,
                    Json({"run_id": self.run_id}), "CAPTURA_NOVA",
                    Json({"classification": candidate.classification_normalized.value}),
                ),
            )

    def persist(self, candidate: NormalizedCandidate, existing_id: str | None) -> Decision:
        self._capture_raw(candidate)
        if existing_id is None:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO engenharia.obras (
                        id_externo, nome, cnpj, municipio, uf, valor_estimado,
                        valor_formatado, fase, descricao, fonte, url_fonte,
                        data_publicacao, visivel, fonte_tipo, status,
                        confianca_extracao, status_portao, portao_confianca,
                        portao_motivo, portao_versao, portao_decidido_em,
                        engineering_classification_original,
                        engineering_classification_normalized,
                        engineering_classification_rule,
                        engineering_classification_confidence,
                        engineering_value_original, engineering_currency_original,
                        engineering_value_source_field, engineering_value_class,
                        engineering_value_rule, engineering_collected_at,
                        engineering_idempotency_key, engineering_content_hash,
                        engineering_updated_at
                    ) VALUES (
                        %s,%s,%s,%s,%s,%s,%s,'CAPTADA',%s,%s,%s,%s,
                        false,'OFICIAL','anunciado',%s,'EM_ANALISE',%s,
                        'aguardando_portao','engineering-gate-v1',now(),
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now()
                    )
                    RETURNING id::text
                    """,
                    (
                        candidate.source_id, candidate.title, candidate.responsible_cnpj,
                        candidate.municipality, candidate.state, candidate.eligible_value,
                        f"R$ {candidate.eligible_value:.2f}", candidate.description,
                        candidate.source, candidate.canonical_url,
                        candidate.published_at.date() if candidate.published_at else None,
                        candidate.classification_confidence,
                        candidate.classification_confidence,
                        candidate.classification_original,
                        candidate.classification_normalized.value,
                        candidate.classification_rule,
                        candidate.classification_confidence,
                        candidate.value_original, candidate.currency_original,
                        candidate.value_source_field, candidate.value_class.value,
                        candidate.value_rule, candidate.collected_at,
                        candidate.idempotency_key, candidate.content_hash,
                    ),
                )
                work_id = cur.fetchone()[0]
            return Decision(Outcome.NOVA, candidate, "persistida como CAPTADA invisível", work_id)

        if self.classify_existing(candidate)[0] == Outcome.SEM_ALTERACAO:
            return Decision(Outcome.SEM_ALTERACAO, candidate, "conteúdo idêntico", existing_id)

        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT nome, descricao, valor_estimado, engineering_value_class,
                       engineering_collected_at, engineering_content_hash
                  FROM engenharia.obras WHERE id = %s FOR UPDATE
                """,
                (existing_id,),
            )
            old = cur.fetchone()
            old_strength = VALUE_STRENGTH.get(old["engineering_value_class"] or "AUSENTE", 0)
            new_strength = VALUE_STRENGTH[candidate.value_class.value]
            newer = not old["engineering_collected_at"] or candidate.collected_at >= old["engineering_collected_at"]
            update_value = newer and new_strength >= old_strength
            new_value = candidate.eligible_value if update_value else old["valor_estimado"]
            changes: dict[str, Any] = {}
            for key, old_value, new_value_field in (
                ("nome", old["nome"], candidate.title),
                ("descricao", old["descricao"], candidate.description),
                ("valor_estimado", old["valor_estimado"], new_value),
            ):
                if str(old_value or "") != str(new_value_field or ""):
                    changes[key] = {"old": str(old_value)[:300], "new": str(new_value_field)[:300]}
            cur.execute(
                """
                UPDATE engenharia.obras SET
                    nome = CASE WHEN %s THEN %s ELSE nome END,
                    descricao = CASE WHEN %s THEN COALESCE(%s, descricao) ELSE descricao END,
                    valor_estimado = %s,
                    engineering_value_original =
                        CASE WHEN %s THEN %s ELSE engineering_value_original END,
                    engineering_value_class =
                        CASE WHEN %s THEN %s ELSE engineering_value_class END,
                    engineering_content_hash = %s,
                    engineering_collected_at = GREATEST(engineering_collected_at, %s),
                    engineering_updated_at = now()
                WHERE id = %s
                """,
                (
                    newer, candidate.title, newer, candidate.description, new_value,
                    update_value, candidate.value_original,
                    update_value, candidate.value_class.value,
                    candidate.content_hash, candidate.collected_at, existing_id,
                ),
            )
            for field, values in changes.items():
                cur.execute(
                    """
                    INSERT INTO engenharia.obras_atualizacoes_log
                        (obra_id,id_externo,fonte,campo,valor_anterior,valor_novo)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        existing_id, candidate.source_id, candidate.source, field,
                        values["old"], values["new"],
                    ),
                )
        return Decision(Outcome.ATUALIZADA, candidate, "informação mais recente/confiável", existing_id)

    def reject(self, decision: Decision) -> None:
        candidate = decision.candidate
        if not candidate:
            return
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO engenharia.engineering_capture_rejections (
                    run_id, source, source_id_hash, reason, classification,
                    value_class, value_original, currency_original, collected_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    self.run_id, candidate.source,
                    candidate.idempotency_key[:16], decision.outcome.value,
                    candidate.classification_normalized.value,
                    candidate.value_class.value, candidate.value_original,
                    candidate.currency_original, candidate.collected_at,
                ),
            )
