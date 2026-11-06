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
CREATE TABLE IF NOT EXISTS usuario (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(150) NOT NULL,
  posicao_na_fila INT UNSIGNED NOT NULL,
  tipo_fila       ENUM('PREFERENCIAL', 'COMUM') NOT NULL,
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  INDEX idx_usuario_fila (tipo_fila, posicao_na_fila)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
