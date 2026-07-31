import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck, Info } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';

/**
 * Catálogo de Leads & Decisores Rurais
 * Rota: /agro/leads
 * Endpoint: GET /agro/decisores
 */
export default function AgroLeadsApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [uf, setUf] = useState(searchParams.get('uf') || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: 1, page_size: 25 };
      if (search) params.search = search;
      if (uf) params.uf = uf;
      const res = await httpClient.get(AGRO_API.decisores, { params });
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar decisores');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, uf]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const p: Record<string, string> = {};
    if (uf) p.uf = uf;
    if (search) p.search = search;
    setSearchParams(p, { replace: true });
  }, [uf, search, setSearchParams]);

  const empty = !loading && !error && items.length === 0;

  // Classifica semântica de vínculo (QSA não produz DECISOR_COMPROVADO isoladamente)
  const getClassification = (item: any) => {
    if (item.comprovado_presencial) return { label: 'DECISOR_COMPROVADO', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' };
    if (item.cargo && (item.cargo.includes('Sócio') || item.cargo.includes('Administrador') || item.fonte === 'RFB/QSA')) {
      return { label: 'SOCIO_ADMINISTRADOR', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' };
    }
    if (item.validado) return { label: 'CONTATO_VALIDADO', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' };
    return { label: 'VINCULO_PROVAVEL', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
  };

  return (
    <AgroPageShell
      title="Leads & Decisores Rurais"
      subtitle="Quadro Societário e Vínculos Agro. O QSA confirma vínculo pessoa–empresa no CNPJ, não poder decisório operacional na fazenda."
      loading={loading} error={error} onRetry={loadData}
      empty={empty} emptyMessage="Nenhum registro encontrado com os filtros atuais."
      statusBadge="Dados RFB / QSA"
    >
      {/* Filtros */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 12px' }}>
          <Search size={16} color="#94A3B8" />
          <input type="text" placeholder="Buscar por nome, cargo, empresa ou município..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') loadData(); }}
            style={{ background: 'none', border: 'none', color: '#F8FAFC', fontSize: 13, width: '100%', outline: 'none' }} />
        </div>
        <BrazilUfSelect value={uf} onChange={v => setUf(v)} showAllLabel="Todas as UFs" />
        <button onClick={loadData} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '7px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Buscar</button>
      </div>

      {/* Ressalva Técnica */}
      <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Info size={16} color="#3B82F6" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: '#CBD5E1' }}>
          <strong>Regra Semântica de Classificação:</strong> Registros originados exclusivamente do Quadro de Sócios e Administradores (QSA/RFB) são rotulados como <code>SOCIO_ADMINISTRADOR</code>. Contatos de e-mail corporativo são identificados como contatos institucionais.
        </div>
      </div>

      {/* Tabela com Colunas Reconciliadas */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
              <th style={{ padding: 10 }}>Pessoa / Nome</th>
              <th style={{ padding: 10 }}>Cargo / Papel</th>
              <th style={{ padding: 10 }}>Empresa / Holding</th>
              <th style={{ padding: 10 }}>Município / UF</th>
              <th style={{ padding: 10 }}>Classificação do Vínculo</th>
              <th style={{ padding: 10 }}>Contato</th>
              <th style={{ padding: 10 }}>Fonte / Evidência</th>
              <th style={{ padding: 10 }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d: any, i: number) => {
              const cls = getClassification(d);
              const scoreVal = d.score !== undefined ? Math.round(d.score) : null;
              return (
                <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={{ padding: 10 }}>
                    <strong style={{ color: '#F8FAFC', display: 'block' }}>{d.nome || 'Nome não autorizado'}</strong>
                    <span style={{ fontSize: 10, color: '#64748B' }}>{d.cpf_mascarado || 'CPF sob sigilo'}</span>
                  </td>
                  <td style={{ padding: 10, color: '#3B82F6', fontWeight: 600 }}>{d.cargo || 'Sócio-Administrador'}</td>
                  <td style={{ padding: 10, color: '#CBD5E1' }}>{d.empresa_vinculada || d.razao_social || 'Empresa Agro'}</td>
                  <td style={{ padding: 10, color: '#94A3B8' }}>{d.municipio || '—'} / {d.uf || '—'}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: cls.bg, color: cls.color }}>
                      {cls.label}
                    </span>
                  </td>
                  <td style={{ padding: 10, fontSize: 11 }}>
                    {d.email || d.whatsapp ? (
                      <span style={{ color: '#22C55E' }}>{d.email || d.whatsapp} (Corporativo)</span>
                    ) : (
                      <span style={{ color: '#64748B' }}>Contato corporativo sob consulta</span>
                    )}
                  </td>
                  <td style={{ padding: 10, fontSize: 11, color: '#94A3B8' }}>
                    <span style={{ display: 'block', color: '#F8FAFC' }}>{d.fonte || 'RFB / QSA'}</span>
                    <span style={{ fontSize: 9, color: '#64748B' }}>Vínculo via CNPJ cadastral</span>
                  </td>
                  <td style={{ padding: 10 }}>
                    {scoreVal !== null ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: scoreVal >= 80 ? '#22C55E' : '#F59E0B' }} title="Score de priorização disponível na fonte; composição detalhada ainda não auditada.">
                        {scoreVal}/100
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#64748B' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AgroPageShell>
  );
}
