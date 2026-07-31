export interface UfDefinition {
  sigla: string;
  nome: string;
  codigoIbge: string;
  regiao: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
  municipios: number;
}

export const ALL_27_UFS: UfDefinition[] = [
  { sigla: 'AC', nome: 'Acre', codigoIbge: '12', regiao: 'Norte', municipios: 22 },
  { sigla: 'AL', nome: 'Alagoas', codigoIbge: '27', regiao: 'Nordeste', municipios: 102 },
  { sigla: 'AP', nome: 'Amapá', codigoIbge: '16', regiao: 'Norte', municipios: 16 },
  { sigla: 'AM', nome: 'Amazonas', codigoIbge: '13', regiao: 'Norte', municipios: 62 },
  { sigla: 'BA', nome: 'Bahia', codigoIbge: '29', regiao: 'Nordeste', municipios: 417 },
  { sigla: 'CE', nome: 'Ceará', codigoIbge: '23', regiao: 'Nordeste', municipios: 184 },
  { sigla: 'DF', nome: 'Distrito Federal', codigoIbge: '53', regiao: 'Centro-Oeste', municipios: 1 },
  { sigla: 'ES', nome: 'Espírito Santo', codigoIbge: '32', regiao: 'Sudeste', municipios: 78 },
  { sigla: 'GO', nome: 'Goiás', codigoIbge: '52', regiao: 'Centro-Oeste', municipios: 246 },
  { sigla: 'MA', nome: 'Maranhão', codigoIbge: '21', regiao: 'Nordeste', municipios: 217 },
  { sigla: 'MT', nome: 'Mato Grosso', codigoIbge: '51', regiao: 'Centro-Oeste', municipios: 141 },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', codigoIbge: '50', regiao: 'Centro-Oeste', municipios: 79 },
  { sigla: 'MG', nome: 'Minas Gerais', codigoIbge: '31', regiao: 'Sudeste', municipios: 853 },
  { sigla: 'PA', nome: 'Pará', codigoIbge: '15', regiao: 'Norte', municipios: 144 },
  { sigla: 'PB', nome: 'Paraíba', codigoIbge: '25', regiao: 'Nordeste', municipios: 223 },
  { sigla: 'PR', nome: 'Paraná', codigoIbge: '41', regiao: 'Sul', municipios: 399 },
  { sigla: 'PE', nome: 'Pernambuco', codigoIbge: '26', regiao: 'Nordeste', municipios: 185 },
  { sigla: 'PI', nome: 'Piauí', codigoIbge: '22', regiao: 'Nordeste', municipios: 224 },
  { sigla: 'RJ', nome: 'Rio de Janeiro', codigoIbge: '33', regiao: 'Sudeste', municipios: 92 },
  { sigla: 'RN', nome: 'Rio Grande do Norte', codigoIbge: '24', regiao: 'Nordeste', municipios: 167 },
  { sigla: 'RS', nome: 'Rio Grande do Sul', codigoIbge: '43', regiao: 'Sul', municipios: 497 },
  { sigla: 'RO', nome: 'Rondônia', codigoIbge: '11', regiao: 'Norte', municipios: 52 },
  { sigla: 'RR', nome: 'Roraima', codigoIbge: '14', regiao: 'Norte', municipios: 15 },
  { sigla: 'SC', nome: 'Santa Catarina', codigoIbge: '42', regiao: 'Sul', municipios: 295 },
  { sigla: 'SP', nome: 'São Paulo', codigoIbge: '35', regiao: 'Sudeste', municipios: 645 },
  { sigla: 'SE', nome: 'Sergipe', codigoIbge: '28', regiao: 'Nordeste', municipios: 75 },
  { sigla: 'TO', nome: 'Tocantins', codigoIbge: '17', regiao: 'Norte', municipios: 139 }
];

export const UF_SIGLAS = ALL_27_UFS.map(u => u.sigla);
