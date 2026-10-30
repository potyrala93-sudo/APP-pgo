/* =========================================================
   CONFIGURAÇÃO DO PGO DIGITAL
   ========================================================= */
window.PGO_CONFIG = {
  // Banco: deixe vazio para usar o mesmo do App de Compras (o app lê o config.js publicado dele).
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Planilhas do Google (precisam estar como "Qualquer pessoa com o link pode ver").
  // É o código que fica no endereço entre /d/ e /edit. Só a primeira aba de cada planilha é lida.
  PLANILHAS: {
    equipes:  '1WzVvLjdpyhIYt94aC4Fsx673gWDWIHlM7-qbtm-92hE',   // colunas: CDC | EQUIPE | TIPO (Manual ou Mecanizado)
    fazendas: '1sJpnNfEwwEbaFHkkLW-yWKN4wyGweZvKN0zu0Q3DhoQ',   // colunas: CDC | FAZENDA | UP | AREA
    insumos:  '1WFNQStJs89TY6_TtFuOaOlGsC7lUvHZQk7GTiGfOyoA',   // colunas: CDC | INSUMO
  },

  // Motivos de hora parada (pode trocar, tirar ou acrescentar)
  MOTIVOS: [
    'Chuva',
    'Manutenção / quebra de máquina',
    'Abastecimento',
    'Falta de insumo',
    'Falta de água',
    'Aguardando liberação da área',
    'Deslocamento',
    'Refeição',
    'Treinamento / DDS',
    'Outros',
  ],
};
