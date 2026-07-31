import React from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight, ShieldCheck } from 'lucide-react';

interface InsightProps {
  title: string;
  category: 'oportunidade' | 'risco' | 'eficiencia' | 'ml_imputacao';
  description: string;
  rationale?: string;
  evidence?: string;
  source?: string;
  confidence: number; // 0-100
  actionText?: string;
  onAction?: () => void;
}

export const AiPrescriptiveCard: React.FC<InsightProps> = ({
  title,
  category,
  description,
  rationale,
  evidence,
  source,
  confidence,
  actionText,
  onAction
}) => {
  const getBadge = () => {
    switch (category) {
      case 'oportunidade':
        return { label: 'Recomendação Baseada em Dados', color: '#22C55E', bg: 'rgba(34,197,94,0.15)', icon: TrendingUp };
      case 'risco':
        return { label: 'Há Indícios de Risco', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: AlertTriangle };
      case 'eficiencia':
        return { label: 'Pode Representar Eficiência', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)', icon: Lightbulb };
      case 'ml_imputacao':
        return { label: 'Correspondência Provável IA', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', icon: Sparkles };
      default:
        return { label: 'IA Insight Prescritivo', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: Sparkles };
    }
  };

  const badge = getBadge();
  const Icon = badge.icon;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
      border: `1px solid ${badge.color}`, borderRadius: 10, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg,
            padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            <Icon size={12} /> {badge.label}
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          Grau de Confiança IA: <strong style={{ color: badge.color }}>{confidence}%</strong>
        </span>
      </div>

      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h4>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{description}</p>

      {rationale && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-base)', padding: 8, borderRadius: 6 }}>
          <strong>Racional:</strong> {rationale}
        </div>
      )}

      {evidence && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          <strong>Evidência Documental:</strong> {evidence} {source && `(Fonte: ${source})`}
        </div>
      )}

      <div style={{ fontSize: 10, color: '#64748B', fontStyle: 'italic', marginTop: 2 }}>
        Limitação: Recomendação baseada em modelos probabilísticos. Não afirma contratação nem vínculo jurídico.
      </div>

      {actionText && (
        <button
          onClick={onAction}
          style={{
            alignSelf: 'flex-start', marginTop: 4, padding: '5px 12px', fontSize: 11, fontWeight: 600,
            background: badge.bg, border: `1px solid ${badge.color}`, color: badge.color, borderRadius: 4,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
          }}
        >
          <span>{actionText}</span> <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
};
