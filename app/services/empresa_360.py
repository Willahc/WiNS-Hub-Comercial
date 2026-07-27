from repositories.empresa_360 import Empresa360Repository


class Empresa360Service:
    def __init__(self, repository: Empresa360Repository):
        self.repository = repository

    def buscar_por_cnpj(self, cnpj: str):
        return self.repository.buscar_por_cnpj(cnpj)

    def buscar_por_id(self, entidade_id: str):
        return self.repository.buscar_por_id(entidade_id)

    def listar(self, *, vertical=None, uf=None, multi_vertical=None,
               situacao=None, q=None, page=1, per_page=50):
        if per_page > 200:
            per_page = 200
        if per_page < 1:
            per_page = 50
        if page < 1:
            page = 1
        offset = (page - 1) * per_page
        result = self.repository.listar(
            vertical=vertical, uf=uf, multi_vertical=multi_vertical,
            situacao=situacao, q=q, limit=per_page, offset=offset,
        )
        result["page"] = page
        result["per_page"] = per_page
        result["pages"] = max(1, -(-result["total"] // per_page))
        return result

    def listar_fontes(self, entidade_id: str):
        return self.repository.listar_fontes(entidade_id)

    def listar_papeis(self, entidade_id: str):
        return self.repository.listar_papeis(entidade_id)

    def listar_conflitos_geograficos(self, entidade_id: str):
        return self.repository.listar_conflitos_geograficos(entidade_id)

    def listar_todas_geografias(self, entidade_id: str):
        return self.repository.listar_todas_geografias(entidade_id)

    def estatisticas(self):
        return self.repository.estatisticas()
