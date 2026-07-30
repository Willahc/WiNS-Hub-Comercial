from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

Confidence = Literal["confirmed", "probable", "possible", "conflicting", "unresolved"]

class Provenance(BaseModel):
    source_system: str
    source_schema: str
    source_table: str
    source_id: str
    source_updated_at: Optional[datetime] = None
    ingested_at: datetime

class CanonicalEntity(BaseModel):
    canonical_id: str
    source_system: str
    source_schema: str
    source_table: str
    source_id: str
    source_updated_at: Optional[datetime] = None
    ingested_at: datetime
    quality_score: int = Field(ge=0, le=100)
    confidence_level: Confidence
    active_status: bool
    provenance: list[Provenance]

class Address(BaseModel):
    street: Optional[str] = None
    number: Optional[str] = None
    district: Optional[str] = None
    postal_code: Optional[str] = None
    municipality: Optional[str] = None
    state: Optional[str] = None
    ibge_code: Optional[str] = None

class GeoLocation(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    precision: Literal["exact", "address", "municipality", "state", "unknown"] = "unknown"

class Company(CanonicalEntity):
    cnpj: Optional[str] = None
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    address: Optional[Address] = None
    location: Optional[GeoLocation] = None

class Supplier(Company):
    cnae: Optional[str] = None
    segment: Optional[str] = None

class Person(CanonicalEntity):
    display_name: str
    contact_classification: Literal["corporate", "public", "restricted", "sensitive", "unknown"]

class DecisionMaker(Person):
    title: Optional[str] = None
    company_id: Optional[str] = None
    work_id: Optional[str] = None

class Work(CanonicalEntity):
    name: str
    company_id: Optional[str] = None
    municipality: Optional[str] = None
    state: Optional[str] = None
    location: Optional[GeoLocation] = None
    value: Optional[float] = None
    status: Optional[str] = None

class EngineeringProject(Work):
    project_model: Literal["work_projection"] = "work_projection"

class Opportunity(CanonicalEntity):
    work_id: str
    company_id: Optional[str] = None
    score: float
    justification: Optional[dict[str, Any]] = None

class Relationship(CanonicalEntity):
    from_id: str
    to_id: str
    relationship_type: str

class SourceRecord(CanonicalEntity):
    payload_hash: Optional[str] = None
