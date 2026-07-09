import type { Translations } from './types.js';

export const pt: Translations = {
  // Start
  START_BUTTON: '🏠 Início',

  // Language
  LANG_BUTTON: '🌐 Idioma',
  LANG_TITLE: '🌐 *Selecione o idioma*',
  LANG_SELECTED: (langName: string) => `✅ Idioma alterado para: ${langName}.`,
  LANG_RUSSIAN: '🇷🇺 Russo',
  LANG_ENGLISH: '🇬🇧 Inglês',
  LANG_UKRAINIAN: '🇺🇦 Ucraniano',
  LANG_PORTUGUESE: '🇵🇹 Português',

  // Commands / Start
  START: (
    'Olá! Vou ajudar você a recortar clipes de vídeos longos para o TikTok (15–25 seg), '
    + 'gerar um roteiro em inglês, narração, legendas e (opcionalmente) publicar.\n\n'
    + 'Envie um link de vídeo (YouTube/TikTok/arquivo) ou faça upload de um arquivo aqui.\n'
    + 'Comandos: /help, /cancel'
  ),
  HELP: (
    'Como funciona:\n'
    + '1) Envie um link ou faça upload de um vídeo (até {max_mb} MB).\n'
    + '2) Escolha as opções pelos botões do menu.\n'
    + '3) Vou montar os clipes com narração (inglês), legendas e enviá-los.\n\n'
    + 'Dicas: os primeiros 2–3 segundos são o gancho! Não abuse da publicação automática (políticas do TikTok).'
  ),
  CANCELLED: 'Ok, cancelado. Se precisar — /start',

  // Source
  ASK_SOURCE: 'Envie um link (YouTube/TikTok) ou faça upload de um arquivo de vídeo.',
  SOURCE_RECEIVED: 'Fonte recebida.',
  INVALID_URL: 'Por favor, envie um link válido ou um arquivo de vídeo.',
  VIDEO_RECEIVED_DOWNLOADING: '📁 Vídeo recebido. Baixando...',

  // Quality
  ASK_QUALITY: (
    'Escolha a qualidade do vídeo para baixar:\n'
    + '1080 - Full HD (melhor qualidade, maior tamanho)\n'
    + '720 - HD\n'
    + '480 - SD\n'
    + '360 - Baixa qualidade (menor tamanho)\n\n'
    + 'Digite: 1080, 720, 480 ou 360'
  ),
  INVALID_QUALITY: 'Por favor, escolha uma qualidade: 1080, 720, 480 ou 360.',
  QUALITY_SELECTED: 'Qualidade {quality}p selecionada. Baixando vídeo...',

  // Trim
  ASK_CLIP_COUNT: 'Quantos clipes criar? (ex.: 3, de 1 a 10)',
  ASK_CUSTOM_SEGMENT: (
    'Especifique o início e o fim do segmento no formato MM:SS separados por espaço.\n'
    + 'Exemplos:\n'
    + '- 0:40 1:00 (de 40 segundos a 1 minuto)\n'
    + '- 1:20 1:40 (de 1 minuto 20 segundos a 1 minuto 40 segundos)'
  ),
  INVALID_SEGMENT_FORMAT: (
    'Formato inválido. Forneça dois horários no formato MM:SS separados por espaço.\n'
    + 'Exemplo: 0:40 1:00'
  ),
  INVALID_SEGMENT_RANGE: 'O início deve ser menor que o fim. Tente novamente.',
  SEGMENT_TOO_SHORT: 'A duração mínima é de 5 segundos.',
  SEGMENT_TOO_LONG: 'A duração máxima é de 60 segundos.',
  INVALID_CLIP_COUNT: 'Digite o número de clipes de 1 a 10.',

  // Main menu
  MAIN_MENU_TITLE: '🎬 *Configurações de processamento de vídeo*\n\nEscolha as opções:',
  UPLOAD_BUTTON: '🚀 Enviar',

  // Button texts (dynamic)
  TRIM_BUTTON: '✂️ Recortar',
  TRIM_TOP_MOMENTS_BTN: (count: number) => `✂️ Recortar: Melhores momentos (${count} clipes) ✓`,
  TRIM_CUSTOM_SEGMENT_BTN: (start: string, end: string) => `✂️ Recortar: Intervalo ${start}-${end} ✓`,
  AUDIO_ONLY_ENABLED: '🎵 Somente áudio (MP3) ✓',
  AUDIO_ONLY_DISABLED: '🎵 Somente áudio (MP3)',
  MUSIC_REPLACED: '🎵 Áudio: Substituído ✓',
  MUSIC_CHANGE: '🎵 Trocar áudio',
  AUDIO_MENU_HEADPHONES: '🎧 Áudio ✓',
  AUDIO_MENU_MUSIC: '🎵 Áudio ✓',
  AUDIO_MENU_DEFAULT: '🎵 Áudio',
  SPEED_BUTTON: (speed: number) => `⚡️ Velocidade: ${speed}x`,
  AUTO_MODE_SELECTED_PLATFORM: (label: string) => `🎯 Modo automático: ${label} ✓`,
  AUTO_MODE_DEFAULT: '🎯 Modo automático',

  // Trim menu
  TRIM_MENU_TITLE: '✂️ *Escolha o tipo de recorte:*',
  TRIM_TOP_MOMENTS: '🎯 Melhores momentos',
  TRIM_TOP_MOMENTS_CHECKED: '🎯 Melhores momentos ✓',
  TRIM_CUSTOM_SEGMENT: '✂️ Segmento personalizado',
  TRIM_CUSTOM_SEGMENT_CHECKED: '✂️ Segmento personalizado ✓',

  // Audio menu
  AUDIO_MENU_TITLE: '🎵 *Configurações de áudio:*',

  // Tags
  TAGS_BUTTON: '🏷️ Tags',
  TAGS_MENU_TITLE: '🏷️ *Quer espiar as tendências para hashtags?*',
  TAGS_YES: '✅ Sim, mostrar tendências',
  TAGS_NO: '❌ Não, pular',
  TAGS_TOP_TRENDS: (formatted: string) => `🏷️ *Principais tendências:*\n${formatted}`,

  // Auto mode
  AUTO_MODE_TITLE: '🎯 *Modo automático*\n\nEscolha uma plataforma — vou configurar automaticamente o recorte, a duração e o número de clipes para o formato:',
  AUTO_MODE_OFF: '❌ Desativar modo automático',
  AUTO_MODE_SELECTED: (platformLabel: string) => `✅ Modo automático ativado: ${platformLabel}.`,
  AUTO_MODE_CLEARED: 'Modo automático desativado. Configurações redefinidas para manual.',

  // Music
  ASK_MUSIC: 'Quer substituir o áudio por uma música? Envie um arquivo mp3 ou digite "não" para pular.',
  MUSIC_RECEIVED: 'Música recebida.',
  NO_MUSIC: 'Sem substituição de áudio.',
  MUSIC_PROMPT_OR_SKIP: 'Por favor, envie um arquivo MP3 ou escreva "não" para pular.',
  ASK_AUDIO_SEGMENT: (
    'Especifique o início e o fim do segmento de áudio no formato MM:SS separados por espaço.\n'
    + 'Exemplos:\n'
    + '- 0:20 1:30 (de 20 segundos a 1 minuto 30 segundos)\n'
    + '- Escreva "tudo" para usar o áudio inteiro'
  ),
  AUDIO_SEGMENT_SELECTED: 'Segmento de áudio selecionado: de {start} a {end}.',
  AUDIO_SEGMENT_ALL: 'Vou usar o áudio inteiro.',

  // Speed
  ASK_PLAYBACK_SPEED: (
    '⚡️ *Velocidade de reprodução*\n\n'
    + 'Velocidade atual: {current}\n\n'
    + 'Digite um novo valor de 0.5 a 3.\n'
    + '• 1 — velocidade normal\n'
    + '• menor que 1 — desaceleração (ex.: 0.5)\n'
    + '• maior que 1 — aceleração (ex.: 1.5, 2, máximo 3)\n\n'
    + 'O separador decimal pode ser ponto ou vírgula.'
  ),
  INVALID_PLAYBACK_SPEED: 'Valor inválido. Digite um número de 0.5 a 3 (ex.: 0.5, 1, 1.5, 2, 3).',
  PLAYBACK_SPEED_SELECTED: (speedLabel: string) => `Velocidade de reprodução definida para: ${speedLabel}.`,
  PLAYBACK_SPEED_RESET: 'Velocidade de reprodução redefinida para o normal (1x).',

  // Processing
  PROCESSING_START: 'Iniciando o processamento. Isso pode demorar. Enviarei o progresso e o resultado.',
  TRIM_REQUIRED: '⚠️ Por favor, escolha um modo de recorte ou ative "Somente áudio (MP3)".',
  SOURCE_INVALID: '❌ Erro: o vídeo não foi enviado. Primeiro envie um vídeo ou link, escolha a qualidade e depois configure as opções.',

  // Common
  BACK_BUTTON: '◀️ Voltar',
  ERROR_GENERIC: 'Ops, algo deu errado. Tente novamente mais tarde.',
  RATE_LIMIT: 'Muito frequente. Tente novamente em instantes.',
  INVALID_INPUT: 'Entrada inválida. Tente novamente.',
  TOO_LARGE: 'Arquivo muito grande. Máximo de {max_mb} MB.',
  DONE: 'Pronto! Enviando clipes e legendas.',
  CALLBACK_ERROR: 'Ocorreu um erro',
  ALREADY_PROCESSING: '⏳ Já estou processando outro vídeo. Aguarde.',

  // Accounts
  ACCOUNTS_BUTTON: '📊 Contas',
  ACCOUNTS_PROMPT: (
    '📊 *Ver contas*\n\n'
    + 'Envie um link ou @username de uma conta do TikTok, Instagram ou YouTube.\n'
    + 'Exemplos:\n'
    + '• @coinbase\n'
    + '• https://www.tiktok.com/@coinbase\n'
    + '• https://www.instagram.com/coinbase/\n'
    + '• https://www.youtube.com/@MrBeast\n\n'
    + 'O bot mostrará os 5 vídeos mais recentes e as estatísticas gerais.'
  ),
  ACCOUNTS_INVALID: 'Não foi possível reconhecer a conta. Envie um link ou @username (TikTok/Instagram/YouTube).',
  ACCOUNTS_FETCHING: '⏳ Coletando dados da conta... (pode levar até 30 segundos)',
  ACCOUNTS_DONE: '✅ Pronto.',

  // Platforms
  PLATFORM_TIKTOK: 'TikTok',
  PLATFORM_SHORTS: 'YouTube Shorts',
  PLATFORM_REELS: 'Instagram Reels',

  // Pipeline messages
  PIPELINE_SENDING_VIDEO: 'Pronto! Enviando vídeo...',
  PIPELINE_VIDEO_TOO_LARGE: (sizeMB: string) => `❌ O vídeo é muito grande para o Telegram (${sizeMB}MB, limite 50MB)`,
  PIPELINE_VIDEO_NO_PROCESSING: 'Vídeo baixado sem processamento',
  PIPELINE_DONE: '✅ Processamento concluído! Digite /start para criar um novo vídeo.',
  PIPELINE_VIDEO_SEND_ERROR: (error: string) => `❌ Erro ao enviar vídeo: ${error}`,
  PIPELINE_EXTRACTING_AUDIO: 'Extraindo áudio...',
  PIPELINE_AUDIO_TOO_LARGE: (sizeMB: string) => `❌ O áudio é muito grande para enviar (${sizeMB}MB)`,
  PIPELINE_AUDIO_EXTRACTED: 'Áudio extraído para MP3',
  PIPELINE_AUDIO_SEND_ERROR: (error: string) => `❌ Erro ao enviar áudio: ${error}`,
  PIPELINE_SEGMENT_NO_TIME: '❌ Erro: nenhum intervalo de tempo especificado para extração de áudio.',
  PIPELINE_SOURCE_NOT_FOUND: '❌ Erro: arquivo de origem não encontrado. O vídeo pode não ter sido enviado. Tente enviar o vídeo novamente.',
  PIPELINE_FILE_NOT_FOUND: '❌ Erro: arquivo de vídeo não encontrado. Ele pode ter sido excluído. Tente enviar o vídeo novamente.',
  PIPELINE_EXTRACTING_SEGMENT: (start: string, end: string) => `🎵 Extraindo áudio do intervalo ${start} - ${end}...`,
  PIPELINE_SEGMENT_TOO_LARGE: (sizeMB: string) => `❌ O áudio é muito grande (${sizeMB}MB)`,
  PIPELINE_SEGMENT_EXTRACTED: (start: string, end: string) => `Áudio extraído do intervalo ${start}-${end}`,
  PIPELINE_SEGMENT_ERROR: (error: string) => `❌ Erro ao extrair áudio: ${error}`,
  PIPELINE_ANALYZING: (backend: string) => `🎬 Analisando o vídeo para encontrar os melhores momentos (${backend}). Isso levará um instante...`,
  PIPELINE_SENDING_CLIPS: 'Pronto! Enviando clipes...',
  PIPELINE_CLIP_TOO_LARGE: (sizeMB: string, caption: string) => `⚠️ O clipe é muito grande para o Telegram (${sizeMB}MB, limite 50MB): ${caption}`,
  PIPELINE_CLIP_SEND_ERROR: (error: string) => `❌ Erro ao enviar clipe: ${error}`,
  PIPELINE_NO_CLIPS_SENT: '❌ Falha ao enviar qualquer clipe. Verifique os logs para detalhes.',
  PIPELINE_PARTIAL_SUCCESS: (sent: number, total: number) => `✅ Enviados ${sent} de ${total} clipes. Digite /start para criar um novo vídeo.`,
  PIPELINE_TASK_ERROR: (error: string) => `Erro ao processar a tarefa: ${error}`,

  // Account report labels
  REPORT_VIDEO: 'Vídeo',
  REPORT_UPLOADED: 'Enviado em',
  REPORT_PLATFORM: 'Plataforma',
  REPORT_SHADOWBAN: 'Shadowban',
  REPORT_SHADOWBAN_YES: '🚫 Sim',
  REPORT_SHADOWBAN_NO: '✅ Não',
  REPORT_TOTAL_STATS: 'Informações da conta',
  REPORT_FOLLOWERS: 'seguidores',
  REPORT_VIDEOS: 'vídeos',
  REPORT_NA: 'N/D',
  REPORT_TOTAL_LIKES: 'total de curtidas',
  REPORT_SAMPLE_STATS: 'Vídeos recentes',
};

export default pt;