-- Schema do banco fila_cabine_votacao
-- Todas as tabelas e colunas sincronizadas 1-para-1 com os models em src/domain

-- 1. Partido (src/domain/candidato/Partido.ts)
CREATE TABLE IF NOT EXISTS partido (
  digito CHAR(2)      NOT NULL,
  nome   VARCHAR(100) NOT NULL,
  CONSTRAINT pk_partido PRIMARY KEY (digito),
  CONSTRAINT uq_partido_nome UNIQUE (nome),
  CONSTRAINT ck_partido_digito CHECK (digito REGEXP '^[0-9]{2}$')
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2. Candidato (src/domain/candidato/Candidato.ts)
-- O candidato "Anular" (id 1) não possui partido nem foto (partido_digito = NULL, url_foto = NULL).
CREATE TABLE IF NOT EXISTS candidato (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(150) NOT NULL,
  url_foto       VARCHAR(500) NULL DEFAULT NULL,
  partido_digito CHAR(2)      NULL DEFAULT NULL,
  CONSTRAINT pk_candidato PRIMARY KEY (id),
  CONSTRAINT fk_candidato_partido FOREIGN KEY (partido_digito)
    REFERENCES partido (digito)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 3. Dispositivos Votantes (src/domain/dispositivo/Dispositivo.ts)
-- Controla estritamente a trava de 1 voto por dispositivo (IP, MAC, Nome, Fingerprint, Token UUID).
CREATE TABLE IF NOT EXISTS dispositivos_votantes (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dispositivo_id     CHAR(64)     NOT NULL,
  token_uuid         VARCHAR(100) NULL DEFAULT NULL,
  ip                 VARCHAR(45)  NOT NULL,
  mac                VARCHAR(17)  NULL DEFAULT NULL,
  nome_dispositivo   VARCHAR(200) NOT NULL,
  user_agent         VARCHAR(500) NULL DEFAULT NULL,
  fingerprint        CHAR(64)     NOT NULL,
  ultimo_nome        VARCHAR(150) NULL DEFAULT NULL,
  ultima_fila        ENUM('PREFERENCIAL', 'COMUM') NULL DEFAULT NULL,
  voto_concluido     BOOLEAN      NOT NULL DEFAULT FALSE,
  usuario_votante_id INT UNSIGNED NULL DEFAULT NULL,
  votou_em           DATETIME(3)  NULL DEFAULT NULL,
  criado_em          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT pk_dispositivo_votante PRIMARY KEY (id),
  CONSTRAINT uq_dispositivo_id UNIQUE (dispositivo_id),
  INDEX idx_dispositivo_token (token_uuid),
  INDEX idx_dispositivo_mac (mac),
  INDEX idx_dispositivo_ip_fp (ip, fingerprint)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 4. Usuario (src/domain/usuario/Usuario.ts)
-- Guarda quem está aguardando na fila (real ou mock) com metadados do dispositivo.
CREATE TABLE IF NOT EXISTS usuario (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome             VARCHAR(150) NOT NULL,
  senha            INT UNSIGNED NOT NULL,
  posicao_na_fila  INT UNSIGNED NOT NULL,
  tipo_fila        ENUM('PREFERENCIAL', 'COMUM') NOT NULL,
  entrou_em        DATETIME(3)  NOT NULL,
  chamado_em       DATETIME(3)  NULL DEFAULT NULL,
  chave            CHAR(32)     NOT NULL,
  mock             BOOLEAN      NOT NULL DEFAULT FALSE,
  ip               VARCHAR(45)  NULL DEFAULT NULL,
  mac              VARCHAR(17)  NULL DEFAULT NULL,
  nome_dispositivo VARCHAR(200) NULL DEFAULT NULL,
  fingerprint      CHAR(64)     NULL DEFAULT NULL,
  dispositivo_id   CHAR(64)     NULL DEFAULT NULL,
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  INDEX idx_usuario_fila (mock, tipo_fila, posicao_na_fila),
  INDEX idx_usuario_dispositivo (dispositivo_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 5. Voto (src/domain/voto/Voto.ts)
-- Guarda quem votou, em quem votou, horários, tempo na fila até a cabine,
-- tempo para votar, tempo de espera da requisição e dispositivo votante.
CREATE TABLE IF NOT EXISTS voto (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  usuario_id          INT UNSIGNED    NULL DEFAULT NULL,
  usuario_nome        VARCHAR(150)    NOT NULL,
  senha               INT UNSIGNED    NOT NULL,
  tipo_fila           ENUM('PREFERENCIAL', 'COMUM') NOT NULL,
  candidato_id        INT UNSIGNED    NOT NULL,
  entrou_na_fila_em   DATETIME(3)     NOT NULL,
  chamado_em          DATETIME(3)     NOT NULL,
  votou_em            DATETIME(3)     NOT NULL,
  tempo_na_fila_ms    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tempo_para_votar_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tempo_requisicao_ms DECIMAL(10, 2)  NULL DEFAULT NULL,
  ip                  VARCHAR(45)     NULL DEFAULT NULL,
  mac                 VARCHAR(17)     NULL DEFAULT NULL,
  nome_dispositivo    VARCHAR(200)    NULL DEFAULT NULL,
  fingerprint         CHAR(64)        NULL DEFAULT NULL,
  dispositivo_id      CHAR(64)        NULL DEFAULT NULL,
  mock                BOOLEAN         NOT NULL DEFAULT FALSE,
  CONSTRAINT pk_voto PRIMARY KEY (id),
  CONSTRAINT uq_voto_usuario UNIQUE (usuario_id),
  CONSTRAINT fk_voto_candidato FOREIGN KEY (candidato_id)
    REFERENCES candidato (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_voto_candidato (candidato_id, mock),
  INDEX idx_voto_dispositivo (dispositivo_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 6. Log de Auditoria Acadêmica (src/domain/auditoria/LogAuditoria.ts)
-- Registra eventos de fila/cabine/voto/bloqueio com tempos de fila, votação e requisição.
CREATE TABLE IF NOT EXISTS log_auditoria (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  operacao            ENUM('CADASTRO_FILA', 'CHAMADA_CABINE', 'VOTO_COMPUTADO', 'BLOQUEIO_DUPLICIDADE', 'SAIDA_FILA') NOT NULL,
  data_hora           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  usuario_id          INT UNSIGNED    NULL DEFAULT NULL,
  eleitor_nome        VARCHAR(150)    NULL DEFAULT NULL,
  tipo_fila           ENUM('PREFERENCIAL', 'COMUM') NULL DEFAULT NULL,
  entrou_na_fila_em   DATETIME(3)     NULL DEFAULT NULL,
  chamado_em          DATETIME(3)     NULL DEFAULT NULL,
  votou_em            DATETIME(3)     NULL DEFAULT NULL,
  tempo_na_fila_ms    BIGINT UNSIGNED NULL DEFAULT NULL,
  tempo_para_votar_ms BIGINT UNSIGNED NULL DEFAULT NULL,
  tempo_requisicao_ms DECIMAL(10, 2)  NULL DEFAULT NULL,
  ip                  VARCHAR(45)     NULL DEFAULT NULL,
  mac                 VARCHAR(17)     NULL DEFAULT NULL,
  nome_dispositivo    VARCHAR(200)    NULL DEFAULT NULL,
  fingerprint         CHAR(64)        NULL DEFAULT NULL,
  dispositivo_id      CHAR(64)        NULL DEFAULT NULL,
  candidato_id        INT UNSIGNED    NULL DEFAULT NULL,
  candidato_nome      VARCHAR(150)    NULL DEFAULT NULL,
  mock                BOOLEAN         NOT NULL DEFAULT FALSE,
  detalhes            VARCHAR(500)    NULL DEFAULT NULL,
  CONSTRAINT pk_log_auditoria PRIMARY KEY (id),
  INDEX idx_log_escopo_data (mock, data_hora)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 7. Log de Requisições HTTP (src/domain/auditoria/LogRequisicao.ts)
-- Registra o tempo de espera/processamento em cada requisição da API.
CREATE TABLE IF NOT EXISTS log_requisicao (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  metodo           VARCHAR(10)      NOT NULL,
  rota             VARCHAR(255)     NOT NULL,
  status_code      SMALLINT UNSIGNED NOT NULL,
  tempo_espera_ms  DECIMAL(10, 2)   NOT NULL,
  ip               VARCHAR(45)      NULL DEFAULT NULL,
  nome_dispositivo VARCHAR(200)     NULL DEFAULT NULL,
  dispositivo_id   CHAR(64)         NULL DEFAULT NULL,
  data_hora        DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT pk_log_requisicao PRIMARY KEY (id),
  INDEX idx_log_req_data_hora (data_hora)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 8. Administrador (src/domain/administrador/Administrador.ts)
CREATE TABLE IF NOT EXISTS administrador (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  login      VARCHAR(50)  NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  CONSTRAINT pk_administrador PRIMARY KEY (id),
  CONSTRAINT uq_administrador_login UNIQUE (login)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Dados iniciais (upsert: idempotente ao reiniciar/migrar e atualiza bancos já existentes)
INSERT INTO partido (digito, nome) VALUES
  ('99', 'PC'),
  ('01', 'MM')
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

INSERT INTO candidato (id, nome, url_foto, partido_digito) VALUES
  (1, 'Anular', NULL, NULL),
  (2, 'Bolso Tse Tung', 'https://preview.redd.it/tem-tse-tung-e-bolso-tse-tung-v0-clr6bxrtoeia1.jpg?width=538&format=pjpg&auto=webp&s=844eeed6eaa81ad6763a2115f678b29303ad4058', '99'),
  (3, 'Macaco Malvado', 'https://i.pinimg.com/236x/fd/78/95/fd78953e5ae0690195fbae31f5c9be1d.jpg', '01')
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  url_foto = VALUES(url_foto),
  partido_digito = VALUES(partido_digito);

-- Remove partidos antigos que não são mais usados por nenhum candidato
DELETE FROM partido
 WHERE digito NOT IN ('99', '01')
   AND digito NOT IN (SELECT partido_digito FROM (SELECT DISTINCT partido_digito FROM candidato WHERE partido_digito IS NOT NULL) AS usados);
