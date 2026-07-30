from __future__ import annotations

import json
import socket
import ssl
import time
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterator
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .pipeline import RawCandidate, ValueClass


class SourceError(RuntimeError):
    pass


class HttpJsonSource:
    name = "base"
    timeout = 60
    attempts = 3
    retries = 0

    def get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        target = f"{url}?{urlencode(params)}"
        for attempt in range(1, self.attempts + 1):
            try:
                req = Request(target, headers={"User-Agent": "WiNSHubEngineering/1.0"})
                with urlopen(req, timeout=self.timeout) as response:
                    return json.loads(response.read())
            except HTTPError as exc:
                retryable = exc.code == 429 or 500 <= exc.code < 600
                if not retryable or attempt == self.attempts:
                    raise SourceError(f"{self.name}: HTTP {exc.code}") from exc
            except json.JSONDecodeError as exc:
                if attempt == self.attempts:
                    raise SourceError(f"{self.name}: PAYLOAD_INCOMPATIBLE") from exc
            except (URLError, TimeoutError, socket.timeout, ssl.SSLError) as exc:
                reason = getattr(exc, "reason", exc)
                if isinstance(reason, socket.gaierror):
                    classification = "DNS"
                elif isinstance(reason, (TimeoutError, socket.timeout)):
                    classification = "TIMEOUT"
                elif isinstance(reason, ssl.SSLError):
                    classification = "CERTIFICATE"
                else:
                    classification = "NETWORK_UNAVAILABLE"
                if attempt == self.attempts:
                    raise SourceError(f"{self.name}: {classification}") from exc
            self.retries += 1
            time.sleep(min(2 ** attempt, 8))
        raise SourceError(f"{self.name}: tentativas esgotadas")


class PncpCivilSource(HttpJsonSource):
    name = "pncp_civil_100k"
    timeout = 20
    endpoint = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"
    modalities = (4, 5, 12)

    def capture(self, *, days: int = 3, max_pages: int = 2) -> Iterator[RawCandidate]:
        end = date.today()
        start = end - timedelta(days=max(1, days))
        for modality in self.modalities:
            for page in range(1, max_pages + 1):
                payload = self.get_json(self.endpoint, {
                    "dataInicial": start.strftime("%Y%m%d"),
                    "dataFinal": end.strftime("%Y%m%d"),
                    "codigoModalidadeContratacao": modality,
                    "pagina": page,
                })
                for rec in payload.get("data") or []:
                    source_id = str(rec.get("numeroControlePNCP") or "")
                    title = str(rec.get("objetoCompra") or "")
                    yield RawCandidate(
                        source=self.name, source_id=source_id, title=title,
                        description=title,
                        value_original=rec.get("valorTotalEstimado"),
                        currency_original="BRL", value_class=ValueClass.PUBLICADO,
                        value_source_field="valorTotalEstimado",
                        canonical_url=(
                            f"https://pncp.gov.br/app/editais/{source_id}"
                            if source_id else "https://pncp.gov.br/app/editais"
                        ),
                        collected_at=datetime.now(timezone.utc),
                        published_at=None,
                        process_number=str(rec.get("processo") or "") or None,
                        tender_number=source_id or None,
                        responsible_cnpj=str(rec.get("orgaoEntidade", {}).get("cnpj") or "") or None,
                        municipality=rec.get("unidadeOrgao", {}).get("municipioNome"),
                        state=rec.get("unidadeOrgao", {}).get("ufSigla"),
                        original_classification=str(rec.get("modalidadeNome") or "") or None,
                        payload=rec,
                    )
                total_pages = int(payload.get("totalPaginas") or 0)
                if page >= total_pages:
                    break


class ObrasGovSource(HttpJsonSource):
    name = "obrasgov_100k"
    timeout = 30
    endpoint = "https://api-publica.obrasgov.gestao.gov.br/obras/projeto-investimento"

    def capture(self, *, days: int = 3, max_pages: int = 2) -> Iterator[RawCandidate]:
        for offset in range(max(1, days) + 1):
            target_date = date.today() - timedelta(days=offset)
            for page in range(1, max_pages + 1):
                payload = self.get_json(self.endpoint, {
                    "dt_cadastro": target_date.isoformat(),
                    "natureza_intervencao": "Obra",
                    "pagina": page, "tamanho_da_pagina": 100,
                })
                for rec in payload.get("data") or []:
                    values = [
                        Decimal(str(item.get("vl_investimento_previsto") or "0"))
                        for item in rec.get("investimentos_previstos") or []
                    ]
                    total = sum(values, Decimal("0"))
                    source_id = str(rec.get("id_projeto_investimento") or "")
                    title = str(rec.get("desc_nome") or rec.get("desc_projeto") or "")
                    description = " ".join(filter(None, (
                        str(rec.get("desc_projeto") or ""),
                        str(rec.get("desc_meta_global") or ""),
                        str(rec.get("especie_intervencao") or ""),
                        " ".join(
                            " ".join(filter(None, (
                                str(x.get("eixo") or ""),
                                str(x.get("tipo") or ""),
                                str(x.get("subtipo") or ""),
                            )))
                            for x in rec.get("eixos_tipos") or []
                        ),
                    )))
                    executors = rec.get("executores") or []
                    cnpj = (
                        str((executors[0] if executors else {}).get("cnpj_executor") or "")
                        or str(rec.get("cnpj_organizacao_resp") or "")
                        or None
                    )
                    yield RawCandidate(
                        source=self.name, source_id=f"OBRASGOV:{source_id}",
                        title=title, description=description,
                        value_original=total, currency_original="BRL",
                        value_class=ValueClass.DOCUMENTAL,
                        value_source_field="investimentos_previstos[].vl_investimento_previsto",
                        canonical_url="https://api-publica.obrasgov.gestao.gov.br/",
                        collected_at=datetime.now(timezone.utc),
                        responsible_cnpj=cnpj, state=rec.get("uf_principal"),
                        original_classification=str(rec.get("natureza_intervencao") or "") or None,
                        payload=rec,
                    )
                if page >= int(payload.get("total_pages") or 0):
                    break


SOURCES = (PncpCivilSource, ObrasGovSource)
