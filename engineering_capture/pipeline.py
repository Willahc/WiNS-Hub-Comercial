from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Iterable, Protocol
from urllib.parse import urlsplit, urlunsplit

from . import PIPELINE_VERSION

MINIMUM_VALUE = Decimal("100000.00")
RULE_VERSION = "engineering-scope-value-v1"


class Classification(str, Enum):
    CIVIL = "CIVIL"
    INDUSTRIAL = "INDUSTRIAL"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


class ValueClass(str, Enum):
    PUBLICADO = "PUBLICADO"
    DOCUMENTAL = "DOCUMENTAL"
    ESTIMADO_REGRA = "ESTIMADO_REGRA"
    ESTIMADO_MODELO = "ESTIMADO_MODELO"
    AUSENTE = "AUSENTE"


class Outcome(str, Enum):
    NOVA = "NOVA"
    ATUALIZADA = "ATUALIZADA"
    SEM_ALTERACAO = "SEM_ALTERAÇÃO"
    DUPLICATA = "DUPLICATA"
    CONFLITO = "CONFLITO"
    REJEITADA_ABAIXO = "REJEITADA_ABAIXO"
    REJEITADA_SEM_VALOR = "REJEITADA_SEM_VALOR"
    REJEITADA_ESCOPO = "REJEITADA_ESCOPO"
    REVISAO_CAMBIO = "REVISAO_CAMBIO"
    INVALIDA = "INVALIDA"


@dataclass(frozen=True)
class RawCandidate:
    source: str
    source_id: str
    title: str
    description: str
    value_original: str | int | Decimal | None
    currency_original: str | None
    value_class: ValueClass
    value_source_field: str | None
    canonical_url: str | None
    collected_at: datetime
    published_at: datetime | None = None
    process_number: str | None = None
    contract_number: str | None = None
    tender_number: str | None = None
    responsible_cnpj: str | None = None
    municipality: str | None = None
    state: str | None = None
    original_classification: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class NormalizedCandidate:
    source: str
    source_id: str
    idempotency_key: str
    content_hash: str
    title: str
    normalized_title: str
    description: str
    classification_original: str | None
    classification_normalized: Classification
    classification_rule: str
    classification_confidence: Decimal
    value_original: Decimal | None
    currency_original: str | None
    eligible_value: Decimal | None
    value_class: ValueClass
    value_source_field: str | None
    value_rule: str
    canonical_url: str | None
    collected_at: datetime
    published_at: datetime | None
    process_number: str | None
    contract_number: str | None
    tender_number: str | None
    responsible_cnpj: str | None
    municipality: str | None
    state: str | None
    payload: dict[str, Any]


@dataclass
class Decision:
    outcome: Outcome
    candidate: NormalizedCandidate | None
    reason: str
    work_id: str | None = None


@dataclass
class Metrics:
    captured_count: int = 0
    civil_count: int = 0
    industrial_count: int = 0
    rejected_below_minimum: int = 0
    rejected_missing_value: int = 0
    rejected_out_of_scope: int = 0
    inserted_count: int = 0
    updated_count: int = 0
    unchanged_count: int = 0
    duplicate_count: int = 0
    conflict_count: int = 0
    errors: int = 0
    retries: int = 0

    def record(self, decision: Decision) -> None:
        if decision.candidate:
            if decision.candidate.classification_normalized == Classification.CIVIL:
                self.civil_count += 1
            elif decision.candidate.classification_normalized == Classification.INDUSTRIAL:
                self.industrial_count += 1
        mapping = {
            Outcome.NOVA: "inserted_count",
            Outcome.ATUALIZADA: "updated_count",
            Outcome.SEM_ALTERACAO: "unchanged_count",
            Outcome.DUPLICATA: "duplicate_count",
            Outcome.CONFLITO: "conflict_count",
            Outcome.REJEITADA_ABAIXO: "rejected_below_minimum",
            Outcome.REJEITADA_SEM_VALOR: "rejected_missing_value",
            Outcome.REJEITADA_ESCOPO: "rejected_out_of_scope",
            Outcome.REVISAO_CAMBIO: "conflict_count",
            Outcome.INVALIDA: "errors",
        }
        setattr(self, mapping[decision.outcome], getattr(self, mapping[decision.outcome]) + 1)


class Repository(Protocol):
    def classify_existing(self, candidate: NormalizedCandidate) -> tuple[Outcome, str | None]: ...
    def persist(self, candidate: NormalizedCandidate, existing_id: str | None) -> Decision: ...
    def reject(self, decision: Decision) -> None: ...


def normalize_text(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", ascii_value.lower())).strip()


def canonicalize_url(value: str | None) -> str | None:
    if not value:
        return None
    parts = urlsplit(value.strip())
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return None
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), "", ""))


def parse_decimal(value: str | int | Decimal | None) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value.quantize(Decimal("0.01"))
    text = str(value).strip()
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    text = re.sub(r"[^0-9.-]", "", text)
    try:
        return Decimal(text).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


CIVIL_TERMS = {
    "obra", "construcao", "edificacao", "hospital", "escola", "residencial",
    "comercial", "infraestrutura urbana", "rodovia", "ponte", "ferrovia",
    "porto", "aeroporto", "saneamento", "drenagem", "pavimentacao", "reforma",
    "ampliacao", "adutora", "esgoto", "urbanizacao",
}
INDUSTRIAL_TERMS = {
    "planta industrial", "fabrica", "refinaria", "mineracao", "usina", "energia",
    "oleo e gas", "terminal", "galpao industrial", "data center", "montagem industrial",
    "instalacao produtiva", "linha de producao", "subestacao", "transmissao",
}
NEGATIVE_TERMS = {
    "compra de material", "aquisicao de material", "servico administrativo",
    "evento", "locacao de imovel", "manutencao rotineira", "fornecimento de material",
    "software", "vigilancia", "limpeza",
}


def classify(title: str, description: str) -> tuple[Classification, Decimal, str]:
    text = normalize_text(f"{title} {description}")
    negative = any(term in text for term in NEGATIVE_TERMS)
    industrial_hits = sum(term in text for term in INDUSTRIAL_TERMS)
    civil_hits = sum(term in text for term in CIVIL_TERMS)
    if negative and not (industrial_hits or civil_hits):
        return Classification.OUT_OF_SCOPE, Decimal("0.95"), f"{RULE_VERSION}:negative"
    if industrial_hits > civil_hits and industrial_hits:
        confidence = min(Decimal("0.99"), Decimal("0.75") + Decimal("0.05") * industrial_hits)
        return Classification.INDUSTRIAL, confidence, f"{RULE_VERSION}:industrial"
    if civil_hits:
        confidence = min(Decimal("0.99"), Decimal("0.75") + Decimal("0.04") * civil_hits)
        return Classification.CIVIL, confidence, f"{RULE_VERSION}:civil"
    return Classification.OUT_OF_SCOPE, Decimal("0.55"), f"{RULE_VERSION}:no-positive-signal"


def normalize(raw: RawCandidate) -> NormalizedCandidate:
    title = re.sub(r"\s+", " ", raw.title or "").strip()
    source_id = re.sub(r"\s+", "", raw.source_id or "")
    normalized_title = normalize_text(title)
    canonical_url = canonicalize_url(raw.canonical_url)
    classification, confidence, rule = classify(title, raw.description)
    original_value = parse_decimal(raw.value_original)
    currency = (raw.currency_original or "BRL").upper()
    eligible = original_value if currency == "BRL" else None
    strong = "|".join(filter(None, (
        raw.source, source_id, raw.process_number, raw.contract_number,
        raw.tender_number, canonical_url,
    )))
    idempotency_key = hashlib.sha256(strong.encode()).hexdigest()
    hash_payload = {
        "source": raw.source, "source_id": source_id, "title": normalized_title,
        "description": normalize_text(raw.description), "value": str(original_value),
        "currency": currency, "url": canonical_url, "municipality": raw.municipality,
        "state": raw.state,
    }
    content_hash = hashlib.sha256(
        json.dumps(hash_payload, sort_keys=True, ensure_ascii=True).encode()
    ).hexdigest()
    return NormalizedCandidate(
        source=raw.source, source_id=source_id, idempotency_key=idempotency_key,
        content_hash=content_hash, title=title, normalized_title=normalized_title,
        description=(raw.description or "").strip()[:4000],
        classification_original=raw.original_classification,
        classification_normalized=classification, classification_rule=rule,
        classification_confidence=confidence, value_original=original_value,
        currency_original=currency, eligible_value=eligible,
        value_class=raw.value_class, value_source_field=raw.value_source_field,
        value_rule=f"{RULE_VERSION}:no-fixed-fallback", canonical_url=canonical_url,
        collected_at=raw.collected_at, published_at=raw.published_at,
        process_number=raw.process_number, contract_number=raw.contract_number,
        tender_number=raw.tender_number,
        responsible_cnpj=re.sub(r"\D", "", raw.responsible_cnpj or "") or None,
        municipality=raw.municipality, state=raw.state, payload=raw.payload,
    )


def evaluate(candidate: NormalizedCandidate) -> Decision:
    if not candidate.source or not candidate.source_id or not candidate.title:
        return Decision(Outcome.INVALIDA, candidate, "payload mínimo inválido")
    if candidate.classification_normalized == Classification.OUT_OF_SCOPE:
        return Decision(Outcome.REJEITADA_ESCOPO, candidate, "fora de CIVIL/INDUSTRIAL")
    if candidate.value_class == ValueClass.AUSENTE or candidate.value_original is None:
        return Decision(Outcome.REJEITADA_SEM_VALOR, candidate, "valor AUSENTE")
    if candidate.currency_original != "BRL":
        return Decision(Outcome.REVISAO_CAMBIO, candidate, "moeda sem conversor oficial")
    if candidate.value_class not in {ValueClass.PUBLICADO, ValueClass.DOCUMENTAL}:
        return Decision(Outcome.REJEITADA_SEM_VALOR, candidate, "estimativa não habilitada na política v1")
    if candidate.eligible_value is None:
        return Decision(Outcome.REJEITADA_SEM_VALOR, candidate, "valor não elegível")
    if candidate.eligible_value < MINIMUM_VALUE:
        return Decision(Outcome.REJEITADA_ABAIXO, candidate, "valor abaixo de R$ 100.000,00")
    return Decision(Outcome.NOVA, candidate, "elegível")


def process(raw: RawCandidate, repository: Repository, *, dry_run: bool) -> Decision:
    candidate = normalize(raw)
    decision = evaluate(candidate)
    if decision.outcome != Outcome.NOVA:
        if not dry_run:
            repository.reject(decision)
        return decision
    existing_outcome, existing_id = repository.classify_existing(candidate)
    if existing_outcome in {Outcome.DUPLICATA, Outcome.CONFLITO}:
        return Decision(existing_outcome, candidate, "deduplicação canônica", existing_id)
    if existing_outcome == Outcome.SEM_ALTERACAO:
        return Decision(Outcome.SEM_ALTERACAO, candidate, "conteúdo idêntico", existing_id)
    if dry_run:
        return Decision(existing_outcome, candidate, "dry-run", existing_id)
    return repository.persist(candidate, existing_id)


def sanitized(candidate: NormalizedCandidate | None) -> dict[str, Any]:
    if not candidate:
        return {}
    return {
        "source": candidate.source,
        "source_id_hash": hashlib.sha256(candidate.source_id.encode()).hexdigest()[:12],
        "classification": candidate.classification_normalized.value,
        "value_class": candidate.value_class.value,
        "eligible_value": str(candidate.eligible_value) if candidate.eligible_value is not None else None,
        "currency": candidate.currency_original,
    }
