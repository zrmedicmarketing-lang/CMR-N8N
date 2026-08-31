CREATE DATABASE IF NOT EXISTS crm_whatsapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crm_whatsapp;

CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) DEFAULT 'Cliente WhatsApp',
  telefono VARCHAR(30) NOT NULL UNIQUE,
  estado VARCHAR(50) DEFAULT 'Nuevo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
 
  ALTER TABLE clientes
ADD COLUMN etapa_embudo VARCHAR(80) DEFAULT 'LEADS_ENTRANTES',
ADD COLUMN monto_estimado DECIMAL(10,2) DEFAULT 0,
ADD COLUMN fecha_ultimo_movimiento DATETIME NULL,
ADD COLUMN observacion_comercial TEXT NULL;
);

CREATE TABLE IF NOT EXISTS mensajes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo ENUM('entrante','saliente') NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','supervisor','asesor') DEFAULT 'asesor',
  activo TINYINT DEFAULT 1,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE respuestas_rapidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  texto TEXT NOT NULL,
  activo TINYINT DEFAULT 1,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

USE crm_whatsapp;

CREATE TABLE auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  usuario_nombre VARCHAR(120) NULL,
  accion VARCHAR(100) NOT NULL,
  entidad VARCHAR(80) NULL,
  entidad_id INT NULL,
  detalle TEXT NULL,
  ip VARCHAR(80) NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contexto_chatbot (
    telefono VARCHAR(30) NOT NULL,
    ultimo_producto VARCHAR(255) DEFAULT NULL,
    ultimo_sku VARCHAR(100) DEFAULT NULL,
    ultima_intencion VARCHAR(50) DEFAULT NULL,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (telefono)
);

CREATE TABLE clientes_identidad (
    id INT AUTO_INCREMENT PRIMARY KEY,

    telefono VARCHAR(20),

    tipo_documento VARCHAR(10) NOT NULL,
    numero_documento VARCHAR(20) NOT NULL,

    nombres VARCHAR(150),
    apellido_paterno VARCHAR(100),
    apellido_materno VARCHAR(100),
    nombre_completo VARCHAR(250),

    departamento VARCHAR(100),
    provincia VARCHAR(100),
    distrito VARCHAR(100),

    direccion_registrada VARCHAR(300),
    direccion_completa_registrada VARCHAR(400),

    ubigeo_reniec VARCHAR(20),
    ubigeo_sunat VARCHAR(20),

    fuente VARCHAR(30) DEFAULT 'factiliza',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY documento_unico (
        tipo_documento,
        numero_documento
    )
);

USE crm_whatsapp;

-- =========================================
-- 1. CORREO DEL CLIENTE
-- =========================================

SET @sql_correo = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE clientes ADD COLUMN correo VARCHAR(180) NULL AFTER documento_numero',
    'SELECT ''clientes.correo ya existe'' AS info'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clientes'
    AND COLUMN_NAME = 'correo'
);

PREPARE stmt_correo FROM @sql_correo;
EXECUTE stmt_correo;
DEALLOCATE PREPARE stmt_correo;


-- =========================================
-- 2. MEDIO DE PAGO CONFIRMADO POR CAJA
-- =========================================

SET @sql_medio_pago = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pagos ADD COLUMN medio_pago_confirmado VARCHAR(40) NULL AFTER medio_pago',
    'SELECT ''pagos.medio_pago_confirmado ya existe'' AS info'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pagos'
    AND COLUMN_NAME = 'medio_pago_confirmado'
);

PREPARE stmt_medio_pago FROM @sql_medio_pago;
EXECUTE stmt_medio_pago;
DEALLOCATE PREPARE stmt_medio_pago;


-- =========================================
-- 3. TABLA PEDIDOS
-- =========================================

CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,

  codigo VARCHAR(30) NULL UNIQUE,

  pago_id INT NOT NULL,
  cliente_id INT NOT NULL,

  cliente_nombre VARCHAR(180) NOT NULL,

  tipo_documento VARCHAR(20) NULL,
  numero_documento VARCHAR(30) NULL,

  correo VARCHAR(180) NULL,
  telefono VARCHAR(20) NOT NULL,

  tipo_entrega VARCHAR(30) NULL,

  direccion TEXT NULL,
  referencia VARCHAR(255) NULL,

  distrito VARCHAR(120) NULL,
  ciudad VARCHAR(120) NULL,
  departamento VARCHAR(120) NULL,

  agencia VARCHAR(180) NULL,

  subtotal_productos DECIMAL(12,2)
    NOT NULL DEFAULT 0,

  costo_delivery DECIMAL(12,2)
    NOT NULL DEFAULT 0,

  total DECIMAL(12,2)
    NOT NULL DEFAULT 0,

  medio_pago_confirmado VARCHAR(40)
    NOT NULL,

  estado_pedido VARCHAR(40)
    NOT NULL DEFAULT 'pendiente_facturacion',

  estado_facturacion VARCHAR(40)
    NOT NULL DEFAULT 'pendiente',

  tipo_comprobante VARCHAR(20) NULL,

  factura_pdf_url VARCHAR(500) NULL,
  factura_xml_url VARCHAR(500) NULL,

  aprobado_por INT NULL,
  aprobado_por_nombre VARCHAR(180) NULL,

  facturado_por INT NULL,
  facturado_por_nombre VARCHAR(180) NULL,

  fecha_pago DATETIME NULL,
  fecha_facturacion DATETIME NULL,
  fecha_envio_correo DATETIME NULL,

  fecha_creacion DATETIME
    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  fecha_actualizacion DATETIME
    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_pedidos_pago_id (pago_id),

  KEY idx_pedidos_cliente_id (cliente_id),

  KEY idx_pedidos_estado_facturacion
    (estado_facturacion),

  KEY idx_pedidos_estado_pedido
    (estado_pedido),

  KEY idx_pedidos_fecha_creacion
    (fecha_creacion)
);


-- =========================================
-- 4. PRODUCTOS DEL PEDIDO
-- =========================================

CREATE TABLE IF NOT EXISTS pedido_items (
  id INT AUTO_INCREMENT PRIMARY KEY,

  pedido_id INT NOT NULL,

  sku VARCHAR(80) NULL,

  nombre_producto VARCHAR(255)
    NOT NULL,

  cantidad DECIMAL(12,2)
    NOT NULL DEFAULT 1,

  precio_unitario DECIMAL(12,2)
    NOT NULL DEFAULT 0,

  subtotal DECIMAL(12,2)
    NOT NULL DEFAULT 0,

  fecha_creacion DATETIME
    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_pedido_items_pedido_id
    (pedido_id),

  KEY idx_pedido_items_sku
    (sku)
);