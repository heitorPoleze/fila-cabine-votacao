-- Schema do banco fila_cabine_votacao
-- Tabelas derivadas dos models em src/domain

-- Partido (src/domain/candidato/Partido.ts)
-- O dígito (2 números) identifica o partido.
CREATE TABLE IF NOT EXISTS partidos (
  digito CHAR(2)      NOT NULL,
  nome   VARCHAR(100) NOT NULL,
  CONSTRAINT pk_partido PRIMARY KEY (digito),
  CONSTRAINT uq_partido_nome UNIQUE (nome),
  CONSTRAINT ck_partido_digito CHECK (digito REGEXP '^[0-9]{2}$')
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Candidato (src/domain/candidato/Candidato.ts)
-- partido_nome e partido_digito do CandidatoRow vêm do LEFT JOIN com partidos.
-- "Anular" é um candidato sem partido e sem foto (botão no front).
CREATE TABLE IF NOT EXISTS candidatos (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(150) NOT NULL,
  url_foto       VARCHAR(500) NULL DEFAULT NULL,
  partido_digito CHAR(2)      NULL DEFAULT NULL,
  votos_totais   INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT pk_candidato PRIMARY KEY (id),
  CONSTRAINT fk_candidato_partido FOREIGN KEY (partido_digito)
    REFERENCES partidos (digito)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Usuario (src/domain/usuario/Usuario.ts + TipoFila.ts)
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(150) NOT NULL,
  tipo_fila       ENUM('PREFERENCIAL', 'COMUM') NOT NULL,
  id_candidato_votado INT UNSIGNED NULL DEFAULT NULL,
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  CONSTRAINT fk_usuario_candidato FOREIGN KEY (id_candidato_votado)
    REFERENCES candidatos (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Dados iniciais (INSERT IGNORE: rodar a migração de novo não duplica)
INSERT IGNORE INTO partidos (digito, nome) VALUES
  ('13', 'Partido dos Trabalhadores'),
  ('22', 'Partido Liberal');

INSERT IGNORE INTO candidatos (id, nome, url_foto, partido_digito) VALUES
  (1, 'Anular', NULL, NULL),
  (2, 'Lula', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_%28ombros%29_denoise.jpg/500px-Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_%28ombros%29_denoise.jpg', '13'),
  (3, 'Flávio Bolsonaro', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Foto_oficial_do_senador_Fl%C3%A1vio_Bolsonaro_%28v._AgSen%29_%283x4%29.jpg/500px-Foto_oficial_do_senador_Fl%C3%A1vio_Bolsonaro_%28v._AgSen%29_%283x4%29.jpg', '22');
