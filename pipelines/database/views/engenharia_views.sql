 matches_obra_prestador |  SELECT (md5((((m.obra_id)::text || m.cnpj) || (c.id)::text)))::uuid AS id,                                                                   +
                        |     m.obra_id,                                                                                                                                +
                        |     m.cnpj,                                                                                                                                   +
                        |     c.id AS categoria_id,                                                                                                                     +
                        |     (row_number() OVER (PARTITION BY m.obra_id, c.id ORDER BY m.score DESC))::integer AS ranking,                                             +
                        |     'estado'::text AS nivel_proximidade,                                                                                                      +
                        |     NULL::numeric AS distancia_km,                                                                                                            +
                        |     m.score,                                                                                                                                  +
                        |     m.gerado_em,                                                                                                                              +
                        |     'regional'::character varying(20) AS escopo                                                                                               +
                        |    FROM ((engenharia.matches_v2 m                                                                                                             +
                        |      JOIN engenharia.obras o ON ((o.id = m.obra_id)))                                                                                         +
                        |      JOIN engenharia.categorias_servico c ON (((m.score_breakdown ->> 'cnae_codigo'::text) = ANY (c.cnaes))));
 vw_projetos_mestre     |  SELECT ov.id AS registro_mestre_id,                                                                                                          +
                        |     ov.titulo,                                                                                                                                +
                        |     ov.descricao AS descricao_obra,                                                                                                           +
                        |     ov.status AS status_obra,                                                                                                                 +
                        |     ov.visivel,                                                                                                                               +
                        |     ov.fontes_encontradas,                                                                                                                    +
                        |     ov.quantidade_fontes,                                                                                                                     +
                        |     ov.campos_complementados,                                                                                                                 +
                        |     ov.conflitos_abertos,                                                                                                                     +
                        |     ov.completude,                                                                                                                            +
                        |     ov.confianca_consolidacao,                                                                                                                +
                        |     ov.validada_em,                                                                                                                           +
                        |     ov.atualizado_em,                                                                                                                         +
                        |     vm_cc002.valor_mestre AS id_externo,                                                                                                      +
                        |     vm_cc009.valor_mestre AS titulo_normalizado,                                                                                              +
                        |     vm_cc010.valor_mestre AS titulo_original,                                                                                                 +
                        |     vm_cc011.valor_mestre AS descricao,                                                                                                       +
                        |     vm_cc013.valor_mestre AS data_publicacao,                                                                                                 +
                        |     vm_cc017.valor_mestre AS valor_capex,                                                                                                     +
                        |     vm_cc018.valor_mestre AS valor_financiamento,                                                                                             +
                        |     vm_cc019.valor_mestre AS valor_referencia,                                                                                                +
                        |     vm_cc022.valor_mestre AS cnpj_contratante,                                                                                                +
                        |     vm_cc026.valor_mestre AS cnpj_executora,                                                                                                  +
                        |     vm_cc028.valor_mestre AS cnpj_beneficiaria,                                                                                               +
                        |     vm_cc030.valor_mestre AS cnpj_requerente,                                                                                                 +
                        |     vm_cc032.valor_mestre AS cnpj_concessionaria,                                                                                             +
                        |     vm_cc035.valor_mestre AS municipio_obra,                                                                                                  +
                        |     vm_cc036.valor_mestre AS municipio_sede,                                                                                                  +
                        |     vm_cc037.valor_mestre AS uf_obra,                                                                                                         +
                        |     vm_cc038.valor_mestre AS uf_sede,                                                                                                         +
                        |     vm_cc042.valor_mestre AS tipo_registro,                                                                                                   +
                        |     vm_cc043.valor_mestre AS setor,                                                                                                           +
                        |     vm_cc044.valor_mestre AS fase_normalizada                                                                                                 +
                        |    FROM ((((((((((((((((((((engenharia.obras_validadas ov                                                                                     +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc002 ON (((vm_cc002.grupo_id = ov.grupo_id) AND (vm_cc002.campo_canonico_id = 'CC-002'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc009 ON (((vm_cc009.grupo_id = ov.grupo_id) AND (vm_cc009.campo_canonico_id = 'CC-009'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc010 ON (((vm_cc010.grupo_id = ov.grupo_id) AND (vm_cc010.campo_canonico_id = 'CC-010'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc011 ON (((vm_cc011.grupo_id = ov.grupo_id) AND (vm_cc011.campo_canonico_id = 'CC-011'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc013 ON (((vm_cc013.grupo_id = ov.grupo_id) AND (vm_cc013.campo_canonico_id = 'CC-013'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc017 ON (((vm_cc017.grupo_id = ov.grupo_id) AND (vm_cc017.campo_canonico_id = 'CC-017'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc018 ON (((vm_cc018.grupo_id = ov.grupo_id) AND (vm_cc018.campo_canonico_id = 'CC-018'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc019 ON (((vm_cc019.grupo_id = ov.grupo_id) AND (vm_cc019.campo_canonico_id = 'CC-019'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc022 ON (((vm_cc022.grupo_id = ov.grupo_id) AND (vm_cc022.campo_canonico_id = 'CC-022'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc026 ON (((vm_cc026.grupo_id = ov.grupo_id) AND (vm_cc026.campo_canonico_id = 'CC-026'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc028 ON (((vm_cc028.grupo_id = ov.grupo_id) AND (vm_cc028.campo_canonico_id = 'CC-028'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc030 ON (((vm_cc030.grupo_id = ov.grupo_id) AND (vm_cc030.campo_canonico_id = 'CC-030'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc032 ON (((vm_cc032.grupo_id = ov.grupo_id) AND (vm_cc032.campo_canonico_id = 'CC-032'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc035 ON (((vm_cc035.grupo_id = ov.grupo_id) AND (vm_cc035.campo_canonico_id = 'CC-035'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc036 ON (((vm_cc036.grupo_id = ov.grupo_id) AND (vm_cc036.campo_canonico_id = 'CC-036'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc037 ON (((vm_cc037.grupo_id = ov.grupo_id) AND (vm_cc037.campo_canonico_id = 'CC-037'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc038 ON (((vm_cc038.grupo_id = ov.grupo_id) AND (vm_cc038.campo_canonico_id = 'CC-038'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc042 ON (((vm_cc042.grupo_id = ov.grupo_id) AND (vm_cc042.campo_canonico_id = 'CC-042'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc043 ON (((vm_cc043.grupo_id = ov.grupo_id) AND (vm_cc043.campo_canonico_id = 'CC-043'::text)))) +
                        |      LEFT JOIN engenharia.valores_mestre vm_cc044 ON (((vm_cc044.grupo_id = ov.grupo_id) AND (vm_cc044.campo_canonico_id = 'CC-044'::text))));

