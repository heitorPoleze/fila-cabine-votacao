-- Schema do banco fila_cabine_votacao
-- Tabelas derivadas dos models em src/domain

-- Partido (src/domain/candidato/Partido.ts)
-- O dígito (2 números) identifica o partido.
CREATE TABLE IF NOT EXISTS partido (
  digito CHAR(2)      NOT NULL,
  nome   VARCHAR(100) NOT NULL,
  CONSTRAINT pk_partido PRIMARY KEY (digito),
  CONSTRAINT uq_partido_nome UNIQUE (nome),
  CONSTRAINT ck_partido_digito CHECK (digito REGEXP '^[0-9]{2}$')
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Candidato (src/domain/candidato/Candidato.ts)
-- partido_nome e partido_digito do CandidatoRow vêm do JOIN com partido.
CREATE TABLE IF NOT EXISTS candidato (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(150) NOT NULL,
  url_foto       VARCHAR(500) NOT NULL,
  partido_digito CHAR(2)      NOT NULL,
  CONSTRAINT pk_candidato PRIMARY KEY (id),
  CONSTRAINT fk_candidato_partido FOREIGN KEY (partido_digito)
    REFERENCES partido (digito)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Usuario (src/domain/usuario/Usuario.ts + TipoFila.ts)
-- Guarda só quem está aguardando. senha é o número fixo do ticket (C007);
-- posicao_na_fila é a posição atual dentro da fila, decrementada quando alguém sai.
-- (Uma tabela usuario no formato antigo, sem a coluna senha, é recriada por src/database/schema.ts.)
CREATE TABLE IF NOT EXISTS usuario (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(150) NOT NULL,
  senha           INT UNSIGNED NOT NULL,
  posicao_na_fila INT UNSIGNED NOT NULL,
  tipo_fila       ENUM('PREFERENCIAL', 'COMUM') NOT NULL,
  entrou_em       DATETIME(3)  NOT NULL,
  chave           CHAR(32)     NOT NULL,
  mock            BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  INDEX idx_usuario_fila (tipo_fila, posicao_na_fila)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Voto (src/domain/voto/Voto.ts)
-- Guarda quem votou, em quem, e os horários para calcular os tempos.
CREATE TABLE IF NOT EXISTS voto (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_nome      VARCHAR(150) NOT NULL,
  senha             INT UNSIGNED NOT NULL,
  tipo_fila         ENUM('PREFERENCIAL', 'COMUM') NOT NULL,
  candidato_id      INT UNSIGNED NOT NULL,
  entrou_na_fila_em DATETIME(3)  NOT NULL,
  chamado_em        DATETIME(3)  NOT NULL,
  votou_em          DATETIME(3)  NOT NULL,
  CONSTRAINT pk_voto PRIMARY KEY (id),
  CONSTRAINT fk_voto_candidato FOREIGN KEY (candidato_id)
    REFERENCES candidato (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_voto_candidato (candidato_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Candidatos da votação: A e B.
INSERT IGNORE INTO partido (digito, nome) VALUES
  ('10', 'Partido Alfa'),
  ('20', 'Partido Beta');

INSERT IGNORE INTO candidato (id, nome, url_foto, partido_digito) VALUES
  (1, 'Candidato A', '', '10'),
  (2, 'Candidato B', '', '20');

-- Administrador (src/domain/administrador/Administrador.ts)
-- A senha é guardada com hash (scrypt). O admin padrão (admin / admin) é criado
-- pelo servidor ao subir, se ainda não existir.
-- Este arquivo é idempotente: o servidor o executa toda vez que sobe.
CREATE TABLE IF NOT EXISTS administrador (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  login      VARCHAR(50)  NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  CONSTRAINT pk_administrador PRIMARY KEY (id),
  CONSTRAINT uq_administrador_login UNIQUE (login)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
