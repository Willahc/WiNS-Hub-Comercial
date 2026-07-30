import re
import unicodedata
from dataclasses import dataclass
from typing import Optional

ResolutionStatus = str

def digits(value: Optional[str]) -> str:
    return re.sub(r"\D", "", value or "")

def valid_cnpj(value: Optional[str]) -> bool:
    number=digits(value)
    if len(number)!=14 or len(set(number))==1:return False
    values=[int(x) for x in number]
    d1=(11-sum(values[i]*(5-i if i<4 else 13-i) for i in range(12))%11)%10
    d2=(11-sum(values[i]*(6-i if i<5 else 14-i) for i in range(13))%11)%10
    return values[12:]==[d1,d2]

def normalize(value: Optional[str]) -> str:
    raw=unicodedata.normalize("NFKD",value or "").encode("ascii","ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9 ]"," ",raw).split())

@dataclass(frozen=True)
class OrganizationIdentity:
    cnpj: Optional[str]=None
    source_id: Optional[str]=None
    name: Optional[str]=None
    municipality: Optional[str]=None
    address: Optional[str]=None
    phone: Optional[str]=None
    domain: Optional[str]=None

@dataclass(frozen=True)
class PersonIdentity:
    company_id: Optional[str]=None
    title: Optional[str]=None
    name: Optional[str]=None
    email: Optional[str]=None
    phone: Optional[str]=None
    source: Optional[str]=None

def resolve_organization(left: OrganizationIdentity,right: OrganizationIdentity)->ResolutionStatus:
    if valid_cnpj(left.cnpj) and valid_cnpj(right.cnpj):return "confirmado" if digits(left.cnpj)==digits(right.cnpj) else "conflitante"
    if left.source_id and right.source_id and left.source_id==right.source_id:return "confirmado"
    same_name=normalize(left.name) and normalize(left.name)==normalize(right.name)
    same_city=normalize(left.municipality) and normalize(left.municipality)==normalize(right.municipality)
    if same_name and same_city:return "provável"
    if same_name and normalize(left.address) and normalize(left.address)==normalize(right.address):return "provável"
    contact=(digits(left.phone) and digits(left.phone)==digits(right.phone)) or (normalize(left.domain) and normalize(left.domain)==normalize(right.domain))
    if same_name and contact:return "possível"
    return "não resolvido"

def resolve_person(left: PersonIdentity,right: PersonIdentity)->ResolutionStatus:
    if left.company_id and right.company_id and left.company_id!=right.company_id:return "conflitante"
    same_name=normalize(left.name) and normalize(left.name)==normalize(right.name)
    if not same_name:return "não resolvido"
    same_email=normalize(left.email) and normalize(left.email)==normalize(right.email)
    same_phone=digits(left.phone) and digits(left.phone)==digits(right.phone)
    same_title=normalize(left.title) and normalize(left.title)==normalize(right.title)
    same_company=left.company_id and left.company_id==right.company_id
    if same_company and (same_email or same_phone):return "confirmado"
    if same_company and same_title and left.source and right.source:return "provável"
    if same_company:return "possível"
    return "não resolvido"
