const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const db = require('./db');
require('dotenv').config();
const preciosRouter =
    require('./routes/precios');
const { TextDecoder } = require('util');

// =======================================
// CORRECCIÓN DE CARACTERES / UTF-8
// =======================================

function textoTieneCodificacionRota(valor) {
  const texto = String(valor || '');

  return (
    texto.includes('\uFFFD') || // �
    /Ã.|Â./.test(texto)
  );
}

function repararTexto(valor) {
  let texto = String(valor || '').trim();

  if (!texto) {
    return '';
  }

  // Ejemplos:
  // MarÃ­a -> María
  // DueÃ±as -> Dueñas
  if (/Ã.|Â./.test(texto)) {

    try {

      const corregido =
        Buffer.from(texto, 'latin1')
          .toString('utf8');

      if (
        corregido &&
        !corregido.includes('\uFFFD')
      ) {
        texto = corregido;
      }

    } catch (error) {
      // Mantener original
    }
  }

  return texto
    .normalize('NFC')
    .trim();
}

console.log(
  'N8N ACTIVIDAD ASESOR:',
  process.env.N8N_ACTIVIDAD_ASESOR_URL
);
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);
const upload = multer({
  dest: 'temp_uploads/',
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});
 
const app = express();
const PORT = process.env.PORT || 3000;
 
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(
    '/api/precios',
    preciosRouter
);
app.use(session({
  secret: process.env.SESSION_SECRET || 'zrmed_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// =======================================
// ACTUALIZACIÓN AUTOMÁTICA DEL EMBUDO
// =======================================

const ETAPAS_EMBUDO_VALIDAS = [
  'LEADS_ENTRANTES',
  'ERROR_REORGANIZAR',
  'MENU',
  'RECIBE_INFORMACION',
  'CLIENTES_ESCRIBEN_NUEVAMENTE',
  'ATENDER_LEAD',
  'ATENDIDOS',
  'INTERESADOS',
  'VISITARA_TIENDA',
  'VALIDAR_PAGO',
  'PAGO_CONFIRMADO',
  'PAGO_NO_CONFIRMADO',
  'ENVIAR_COMPROBANTE_ATENDER',
  'DESPACHO',
  'VENTA_GANADA',
  'VENTA_PERDIDA'
];
const ORDEN_ETAPAS_EMBUDO = {
  LEADS_ENTRANTES: 1,
  ERROR_REORGANIZAR: 1,
  MENU: 2,
  RECIBE_INFORMACION: 3,
  CLIENTES_ESCRIBEN_NUEVAMENTE: 4,
  ATENDER_LEAD: 5,
  ATENDIDOS: 6,
  INTERESADOS: 7,
  VISITARA_TIENDA: 8,
  VALIDAR_PAGO: 9,
  PAGO_NO_CONFIRMADO: 10,
  PAGO_CONFIRMADO: 11,
  ENVIAR_COMPROBANTE_ATENDER: 12,
  DESPACHO: 13,
  VENTA_GANADA: 14,
  VENTA_PERDIDA: 14
};
function normalizarTelefonoEmbudo(valor) {
  let telefono = String(valor || '')
    .replace(/\D/g, '');

  if (telefono.length === 9) {
    telefono = `51${telefono}`;
  }

  return telefono;
}

async function actualizarEtapaEmbudoPorCliente(
  clienteId,
  etapaEmbudo
) {
  const etapa = String(
    etapaEmbudo || ''
  )
    .trim()
    .toUpperCase();

  if (
    !clienteId ||
    !ETAPAS_EMBUDO_VALIDAS.includes(etapa)
  ) {
    return false;
  }

  const [resultado] = await db.query(
    `
    UPDATE clientes
    SET
      etapa_embudo = ?,
      fecha_ultimo_movimiento = NOW(),
      fecha_actualizacion = NOW()
    WHERE id = ?
    `,
    [etapa, clienteId]
  );

  return resultado.affectedRows > 0;
}

async function actualizarEtapaEmbudoPorTelefono(
  telefonoOriginal,
  etapaEmbudo,
  permitirRetroceso = false
) {
  const telefono =
    normalizarTelefonoEmbudo(
      telefonoOriginal
    );

  const etapaNueva = String(
    etapaEmbudo || ''
  )
    .trim()
    .toUpperCase();

  if (
    !telefono ||
    !ETAPAS_EMBUDO_VALIDAS.includes(
      etapaNueva
    )
  ) {
    return false;
  }

  const [clientes] = await db.query(
    `
    SELECT
      id,
      etapa_embudo
    FROM clientes
    WHERE telefono = ?
    LIMIT 1
    `,
    [telefono]
  );

  if (!clientes.length) {
    return false;
  }

  const cliente = clientes[0];

  const etapaActual =
    cliente.etapa_embudo ||
    'LEADS_ENTRANTES';

  const nivelActual =
    ORDEN_ETAPAS_EMBUDO[
      etapaActual
    ] || 0;

  const nivelNuevo =
    ORDEN_ETAPAS_EMBUDO[
      etapaNueva
    ] || 0;

  if (
    !permitirRetroceso &&
    nivelNuevo < nivelActual
  ) {
    return true;
  }

  await db.query(
    `
    UPDATE clientes
    SET
      etapa_embudo = ?,
      fecha_ultimo_movimiento = NOW(),
      fecha_actualizacion = NOW()
    WHERE id = ?
    `,
    [
      etapaNueva,
      cliente.id
    ]
  );

  return true;
}

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;

    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE usuario = ? AND activo = 1 LIMIT 1',
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    const valido = await bcrypt.compare(password, user.password_hash);

    if (!valido) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

req.session.usuario = {
  id: user.id,
  nombre: user.nombre,
  usuario: user.usuario,
  rol: user.rol,
  foto_url: user.foto_url,

  perfil_permisos:
    user.perfil_permisos ||
    (
      String(user.rol || '')
        .toLowerCase() === 'admin'
        ? 'administrador'
        : 'propios'
    ),

  permisos:
    normalizarPermisosBackend(
      user.permisos
    )
};

    res.json({ ok: true, usuario: req.session.usuario });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get(
  '/api/me',
  requiereLogin,
  async (req, res) => {
    try {
      const usuario =
        await cargarUsuarioSesionCompleto(req);

      if (!usuario) {
        return res.status(401).json({
          ok: false,
          error:
            'Usuario no encontrado.'
        });
      }

      req.session.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        usuario: usuario.usuario,
        rol: usuario.rol,
        foto_url: usuario.foto_url,
        permisos: usuario.permisos,
        perfil_permisos:
          usuario.perfil_permisos
      };

      return res.json({
        ok: true,
        usuario: req.session.usuario
      });

    } catch (error) {
      console.error(
        'ERROR /api/me:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          'No se pudo cargar el usuario.'
      });
    }
  }
);
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
async function obtenerOCrearCliente({
  nombre,
  telefono
}) {

  const numero =
    String(
      telefono || ''
    ).trim();


  if (!numero) {

    throw new Error(
      'Telefono requerido'
    );

  }


  // =====================================
  // BUSCAR CLIENTE
  // =====================================

  const [clientes] =
    await db.query(
      `
      SELECT
        id,
        nombre,
        asesor_id,
        asesor_nombre

      FROM clientes

      WHERE telefono = ?

      LIMIT 1
      `,
      [
        numero
      ]
    );


  let clienteId;


  // =====================================
  // CLIENTE YA EXISTE
  // =====================================

  if (
    clientes.length > 0
  ) {
  const cliente =
    clientes[0];
    clienteId =
      cliente.id;


    if (
      nombre &&
      cliente.nombre ===
        'Cliente WhatsApp'
    ) {

      await db.query(
        `
        UPDATE clientes
        SET nombre = ?
        WHERE id = ?
        `,
        [
          nombre,
          clienteId
        ]
      );

    }

  } else {

    // =====================================
    // NUEVO CLIENTE
    // =====================================

    const [nuevo] =
      await db.query(
        `
        INSERT INTO clientes
        (
          nombre,
          telefono,
          modo_atencion
        )

        VALUES
        (
          ?,
          ?,
          'bot'
        )
        `,
        [
          nombre ||
            'Cliente WhatsApp',

          numero
        ]
      );


    clienteId =
      nuevo.insertId;

  }


  // =====================================
  // ASEGURAR RESPONSABLE COMERCIAL
  // =====================================

  await asegurarAsesorSeguimiento(
    clienteId
  );


  return clienteId;

}

async function guardarError(origen, error, data = null) {
  try {
    await db.query(
      'INSERT INTO logs_errores (origen, error, data) VALUES (?, ?, ?)',
      [
        origen,
        error?.message || String(error),
        data ? JSON.stringify(data) : null
      ]
    );
  } catch (err) {
    console.error('Error al guardar log:', err.message);
  }
}
async function registrarAuditoria(
  req,
  accion,
  entidad = null,
  entidadId = null,
  detalle = null
) {
  try {
    const usuario = req.session?.usuario || null;

    const usuarioId = usuario?.id || null;
    const usuarioNombre = usuario?.nombre || 'Sistema';

    const ip =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      null;

    const detalleFinal =
      typeof detalle === 'object'
        ? JSON.stringify(detalle)
        : detalle;

    await db.query(
      `INSERT INTO auditoria
       (
         usuario_id,
         usuario_nombre,
         accion,
         entidad,
         entidad_id,
         detalle,
         ip
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        usuarioNombre,
        accion,
        entidad,
        entidadId,
        detalleFinal,
        ip
      ]
    );

  } catch (error) {
    console.error('ERROR AUDITORÍA:', error.message);
  }
}
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const {
    nombre,
    telefono,
    mensaje,
    tipo_media,
    media_url,
    wa_message_id,
    nombre_archivo,
    mime_type
} = req.body;

    if (!telefono || !mensaje) {
      return res.status(400).json({
        ok: false,
        error: 'telefono y mensaje son requeridos'
      });
    }

    let telefonoLimpio = String(telefono || '').replace(/\D/g, '');

    if (telefonoLimpio.length === 9) {
      telefonoLimpio = '51' + telefonoLimpio;
    }

    const clienteId = await obtenerOCrearCliente({
      nombre,
      telefono: telefonoLimpio
    });

if (wa_message_id) {
  const [existe] = await db.query(
    `SELECT id, media_url, tipo_media
     FROM mensajes
     WHERE wa_message_id = ?
     LIMIT 1`,
    [wa_message_id]
  );

  if (existe.length > 0) {
    const mensajeExistente = existe[0];

    // Cuando n8n ya descargó el archivo, completar el registro anterior
    if (media_url && !mensajeExistente.media_url) {
      await db.query(
        `UPDATE mensajes
         SET mensaje = ?,
             tipo_media = ?,
             media_url = ?,
             nombre_archivo = ?,
             mime_type = ?
         WHERE id = ?`,
        [
          mensaje,
          tipo_media || mensajeExistente.tipo_media || 'document',
          media_url,
          nombre_archivo || null,
          mime_type || null,
          mensajeExistente.id
        ]
      );

      await db.query(
        `UPDATE clientes
         SET ultimo_mensaje = ?,
             fecha_actualizacion = NOW()
         WHERE id = ?`,
        [mensaje, clienteId]
      );

      return res.json({
        ok: true,
        actualizado: true,
        cliente_id: clienteId
      });
    }

    return res.json({
      ok: true,
      duplicado: true,
      cliente_id: clienteId
    });
  }
}

 await db.query(`
INSERT INTO mensajes
(
cliente_id,
telefono,
mensaje,
tipo,
tipo_media,
media_url,
wa_message_id,
nombre_archivo,
mime_type
)
VALUES
(
?,
?,
?,
'entrante',
?,
?,
?,
?,
?
)
`,[
clienteId,
telefonoLimpio,
mensaje,
tipo_media || "text",
media_url || null,
wa_message_id || null,
nombre_archivo || null,
mime_type || null
]);

await db.query(
  `
  UPDATE clientes

  SET

    telefono = ?,

    ultimo_mensaje = ?,

    ultimo_tipo =
      'entrante',

    no_leidos =
      no_leidos + 1,

    ultima_interaccion_cliente =
      NOW(),

    /*
     * Si estaba archivado,
     * vuelve a la bandeja.
     *
     * IMPORTANTE:
     * NO cambiamos modo_atencion aquí.
     *
     * Si está siendo atendido por
     * un asesor, continúa en asesor.
     *
     * Si estaba en bot,
     * continúa en bot.
     */
    archivado =
      0,

    fecha_archivado =
      NULL,

    fecha_actualizacion =
      NOW()

  WHERE id = ?
  `,
  [
    telefonoLimpio,
    mensaje,
    clienteId
  ]
);

    const [pendientes] = await db.query(
      `SELECT id, mensaje, telefono
       FROM mensajes
       WHERE cliente_id = ?
       AND pendiente = 1
       ORDER BY id ASC
       LIMIT 1`,
      [clienteId]
    );

    if (pendientes.length > 0) {
      const pendiente = pendientes[0];

      console.log("MENSAJE PENDIENTE DETECTADO:", pendiente.mensaje);

      const respuestaMeta = await axios.post(
        `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: telefonoLimpio,
          type: "text",
          text: {
            body: pendiente.mensaje
          }
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

      const waMessageIdPendiente = respuestaMeta.data.messages?.[0]?.id ?? null;

      await db.query(
        `UPDATE mensajes
         SET pendiente = 0,
             estado_mensaje = 'enviado',
             wa_message_id = ?
         WHERE id = ?`,
        [waMessageIdPendiente, pendiente.id]
      );

      await db.query(
        `UPDATE clientes
         SET ultimo_mensaje = ?,
             ultimo_tipo = 'saliente',
             fecha_actualizacion = NOW()
         WHERE id = ?`,
        [pendiente.mensaje, clienteId]
      );

      console.log("MENSAJE PENDIENTE ENVIADO:", pendiente.mensaje);
    }

    return res.json({
      ok: true,
      cliente_id: clienteId
    });

  } catch (error) {
    await guardarError('webhook/whatsapp', error.response?.data || error, req.body);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.json({
        ok: true,
        duplicado: true
      });
    }

    console.error("ERROR WEBHOOK WHATSAPP:", error.response?.data || error.message);

    return res.status(500).json({
      ok: false,
      error: error.response?.data || error.message
    });
  }
});
app.get(
  '/api/clientes',
  requiereLogin,
  async (req, res) => {

    try {

      const usuarioActual =
        req.session.usuario;


      const rol =
        String(
          usuarioActual?.rol || ''
        )
          .trim()
          .toLowerCase();


      const esAsesor =
        [
          'asesor',
          'asesora'
        ].includes(
          rol
        );


      let consulta = `
        SELECT
          id,
          nombre,
          telefono,
          estado,

          modo_atencion,

          asesor_id,
          asesor_nombre,

          requiere_asesor,
          fecha_solicitud_asesor,

          ultimo_mensaje,
          ultimo_tipo,

          no_leidos,

          ultima_interaccion_cliente,

          fecha_creacion,
          fecha_actualizacion

        FROM clientes

        WHERE
          archivado = 0
      `;


      const parametros =
        [];


      // =====================================
      // ASESOR:
      // SOLO SUS CLIENTES
      // =====================================

      if (
        esAsesor
      ) {

        consulta += `
          AND asesor_id = ?
        `;


        parametros.push(
          usuarioActual.id
        );

      }


      consulta += `
        ORDER BY
          fecha_actualizacion DESC
      `;


      const [clientes] =
        await db.query(
          consulta,
          parametros
        );


      return res.json(
        clientes
      );


    } catch (error) {

      console.error(
        'ERROR LISTANDO CLIENTES:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          'Error al listar clientes'
      });

    }

  }
);

// =======================================
// PERFIL COMPLETO DEL CLIENTE
// =======================================

app.get(
  '/api/clientes/:id/perfil',
  requiereLogin,
  async (req, res) => {

    try {

      const clienteId =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(clienteId) ||
        clienteId <= 0
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Cliente inválido.'
        });

      }


      const [clientes] =
        await db.query(
          `
          SELECT

            id,

            nombre,
            telefono,

            documento_tipo,
            documento_numero,

            correo,

            asesor_id,
            asesor_nombre,

            fecha_creacion,

            tipo_comprobante,

            facturacion_nombre,
            facturacion_documento_tipo,
            facturacion_documento_numero,

            direccion,
            departamento,

            ciudad AS provincia,

            distrito,

            agencia,
            sede

          FROM clientes

          WHERE id = ?

          LIMIT 1
          `,
          [
            clienteId
          ]
        );


      if (!clientes.length) {

        return res.status(404).json({
          ok: false,
          error:
            'Cliente no encontrado.'
        });

      }


      return res.json({
        ok: true,
        cliente:
          clientes[0]
      });


    } catch (error) {

      console.error(
        'ERROR CARGANDO PERFIL CLIENTE:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }

  }
);
// =======================================
// ACTUALIZAR PERFIL DEL CLIENTE
// =======================================

app.put(
  '/api/clientes/:id/perfil',
  requiereLogin,
  async (req, res) => {

    try {

      const clienteId =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(clienteId) ||
        clienteId <= 0
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Cliente inválido.'
        });

      }


      const nombre =
        String(
          req.body.nombre || ''
        ).trim();


      const documentoTipo =
        String(
          req.body.documento_tipo || ''
        )
          .trim()
          .toUpperCase();


      const documentoNumero =
        String(
          req.body.documento_numero || ''
        )
          .replace(
            /\D/g,
            ''
          );


      const correo =
        String(
          req.body.correo || ''
        ).trim();


      const asesorId =
        req.body.asesor_id
          ? Number(
              req.body.asesor_id
            )
          : null;


      const tipoComprobante =
        String(
          req.body.tipo_comprobante || ''
        )
          .trim()
          .toLowerCase();


      const facturacionNombre =
        String(
          req.body.facturacion_nombre ||
          ''
        ).trim();


      const facturacionDocumentoTipo =
        String(
          req.body
            .facturacion_documento_tipo ||
          ''
        )
          .trim()
          .toUpperCase();


      const facturacionDocumentoNumero =
        String(
          req.body
            .facturacion_documento_numero ||
          ''
        )
          .replace(
            /\D/g,
            ''
          );


      const direccion =
        String(
          req.body.direccion || ''
        ).trim();


      const departamento =
        String(
          req.body.departamento || ''
        ).trim();


      const provincia =
        String(
          req.body.provincia || ''
        ).trim();


      const distrito =
        String(
          req.body.distrito || ''
        ).trim();


      const agencia =
        String(
          req.body.agencia || ''
        ).trim();


      const sede =
        String(
          req.body.sede || ''
        ).trim();


      if (!nombre) {

        return res.status(400).json({
          ok: false,
          error:
            'El nombre es obligatorio.'
        });

      }


      // ===================================
      // VALIDAR DOCUMENTO PRINCIPAL
      // ===================================

      if (
        documentoTipo === 'DNI' &&
        documentoNumero &&
        documentoNumero.length !== 8
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'El DNI debe tener 8 dígitos.'
        });

      }


      if (
        documentoTipo === 'RUC' &&
        documentoNumero &&
        documentoNumero.length !== 11
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'El RUC debe tener 11 dígitos.'
        });

      }


      // ===================================
      // OBTENER ASESOR
      // ===================================

      let asesorNombre =
        null;


      if (asesorId) {

        const [asesores] =
          await db.query(
            `
            SELECT
              id,
              nombre

            FROM usuarios

            WHERE id = ?
              AND activo = 1

            LIMIT 1
            `,
            [
              asesorId
            ]
          );


        if (!asesores.length) {

          return res.status(400).json({
            ok: false,
            error:
              'El asesor seleccionado no existe.'
          });

        }


        asesorNombre =
          asesores[0].nombre;

      }


      // ===================================
      // ACTUALIZAR
      // ===================================

      await db.query(
        `
        UPDATE clientes

        SET

          nombre = ?,

          documento_tipo = ?,
          documento_numero = ?,

          correo = ?,

          asesor_id = ?,
          asesor_nombre = ?,

          tipo_comprobante = ?,

          facturacion_nombre = ?,

          facturacion_documento_tipo = ?,

          facturacion_documento_numero = ?,

          direccion = ?,

          departamento = ?,

          ciudad = ?,

          distrito = ?,

          agencia = ?,

          sede = ?,

          fecha_actualizacion =
            NOW()

        WHERE id = ?
        `,
        [
          nombre,

          documentoTipo || null,
          documentoNumero || null,

          correo || null,

          asesorId,
          asesorNombre,

          tipoComprobante || null,

          facturacionNombre || null,

          facturacionDocumentoTipo ||
            null,

          facturacionDocumentoNumero ||
            null,

          direccion || null,

          departamento || null,

          provincia || null,

          distrito || null,

          agencia || null,

          sede || null,

          clienteId
        ]
      );


      await registrarAuditoria(
        req,
        'EDITAR_PERFIL_CLIENTE',
        'clientes',
        clienteId,
        {
          nombre,
          documento_tipo:
            documentoTipo,
          documento_numero:
            documentoNumero,
          asesor_id:
            asesorId
        }
      );


      return res.json({
        ok: true,
        cliente_id:
          clienteId,
        nombre,
        asesor_id:
          asesorId,
        asesor_nombre:
          asesorNombre
      });


    } catch (error) {

      console.error(
        'ERROR ACTUALIZANDO PERFIL:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }

  }
);

app.get(
  '/api/asesores',
  requiereLogin,
  async (req, res) => {

    try {

      const [asesores] =
        await db.query(
          `
          SELECT
            id,
            nombre

          FROM usuarios

          WHERE activo = 1
            AND LOWER(rol)
              IN ('asesor', 'asesora')

          ORDER BY nombre ASC
          `
        );


      return res.json({
        ok: true,
        asesores
      });


    } catch (error) {

      return res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }

  }
);
app.get(
  '/api/clientes/buscar',
  requiereLogin,
  async (req, res) => {

    try {

      const texto =
        String(
          req.query.q || ''
        ).trim();


      if (!texto) {

        return res.json(
          []
        );

      }


      const usuarioActual =
        req.session.usuario;


      const rol =
        String(
          usuarioActual?.rol || ''
        )
          .trim()
          .toLowerCase();


      const esAsesor =
        [
          'asesor',
          'asesora'
        ].includes(
          rol
        );


      const termino =
        `%${texto}%`;


      let consulta = `
        SELECT
          id,
          nombre,
          telefono,
          estado,

          modo_atencion,

          asesor_id,
          asesor_nombre,

          requiere_asesor,
          fecha_solicitud_asesor,

          ultimo_mensaje,
          ultimo_tipo,

          no_leidos,

          ultima_interaccion_cliente,

          fecha_creacion,
          fecha_actualizacion

        FROM clientes

        WHERE
          archivado = 0

          AND
          (
            nombre LIKE ?

            OR telefono LIKE ?

            OR ultimo_mensaje LIKE ?

            OR estado LIKE ?

            OR asesor_nombre LIKE ?
          )
      `;


      const parametros = [
        termino,
        termino,
        termino,
        termino,
        termino
      ];


      if (
        esAsesor
      ) {

        consulta += `
          AND asesor_id = ?
        `;


        parametros.push(
          usuarioActual.id
        );

      }


      consulta += `
        ORDER BY
          fecha_actualizacion DESC

        LIMIT 100
      `;


      const [clientes] =
        await db.query(
          consulta,
          parametros
        );


      return res.json(
        clientes
      );


    } catch (error) {

      console.error(
        'ERROR BUSCAR CLIENTES:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          'No se pudo realizar la búsqueda'
      });

    }

  }
);

app.get(
  '/api/mensajes/:clienteId',
  requiereLogin,
  async (req, res) => {

    try {

      const clienteId =
        Number(
          req.params.clienteId
        );


      const usuarioActual =
        req.session.usuario;


      if (
        !Number.isInteger(
          clienteId
        ) ||
        clienteId <= 0
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Cliente inválido'
        });

      }


      const rol =
        String(
          usuarioActual?.rol || ''
        )
          .trim()
          .toLowerCase();


      const esAsesor =
        [
          'asesor',
          'asesora'
        ].includes(
          rol
        );


      // =====================================
      // VALIDAR PROPIEDAD DEL CHAT
      // =====================================

      if (
        esAsesor
      ) {

        const [propiedad] =
          await db.query(
            `
            SELECT id

            FROM clientes

            WHERE id = ?
              AND asesor_id = ?

            LIMIT 1
            `,
            [
              clienteId,
              usuarioActual.id
            ]
          );


        if (
          !propiedad.length
        ) {

          return res.status(403).json({
            ok: false,
            bloqueado: true,
            error:
              'Este cliente pertenece a otro asesor.'
          });

        }

      }


      const [mensajes] =
        await db.query(
          `
          SELECT *

          FROM mensajes

          WHERE cliente_id = ?

          ORDER BY fecha ASC
          `,
          [
            clienteId
          ]
        );


      return res.json(
        mensajes
      );


    } catch (error) {

      console.error(
        'ERROR LISTANDO MENSAJES:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          'Error al listar mensajes'
      });

    }

  }
);


app.patch('/api/clientes/:clienteId/estado', requiereLogin, async (req, res) => {
  try {
    const { estado } = req.body;
    await db.query('UPDATE clientes SET estado = ? WHERE id = ?', [estado, req.params.clienteId]);
     await registrarAuditoria(
      req,
      'CAMBIAR_ESTADO_CLIENTE',
      'clientes',
      req.params.clienteId,
      {
        nuevo_estado: estado
      }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al actualizar estado' });
  }
});

// =======================================
// NOTIFICAR ACTIVIDAD DEL ASESOR A N8N
// =======================================

async function notificarActividadAsesorN8n({
  clienteId,
  telefono,
  asesorId,
  asesorNombre,
  waMessageId = null
}) {

  const url = String(
    process.env.N8N_ACTIVIDAD_ASESOR_URL || ''
  ).trim();

  if (!url) {
    console.warn(
      'N8N_ACTIVIDAD_ASESOR_URL no está configurada.'
    );

    return false;
  }

  try {

    await axios.post(
      url,
      {
        cliente_id: clienteId,
        telefono,
        asesor_id: asesorId || null,
        asesor_nombre: asesorNombre || '',
        wa_message_id: waMessageId || null,
        timestamp: Date.now()
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },

        timeout: 10000
      }
    );

    return true;

  } catch (error) {

    console.error(
      'ERROR NOTIFICANDO ACTIVIDAD ASESOR A N8N:',
      error.response?.data ||
      error.message
    );

    return false;
  }
}
async function subirArchivoAMeta({
  rutaArchivo,
  nombreArchivo,
  mimeType
}) {
  if (!fs.existsSync(rutaArchivo)) {
    throw new Error('El archivo local ya no existe');
  }

  const form = new FormData();

  form.append('messaging_product', 'whatsapp');

  form.append('file', fs.createReadStream(rutaArchivo), {
    filename: nombreArchivo,
    contentType: mimeType
  });

  const respuesta = await axios.post(
    `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        ...form.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000
    }
  );

  return respuesta.data.id;
}

app.post('/api/enviar', requiereLogin, async (req, res) => {
  const { cliente_id, telefono, mensaje } = req.body;

  const usuarioActual = req.session.usuario;

  let telefonoLimpio = String(telefono || '').replace(/\D/g, '');

  if (telefonoLimpio.length === 9) {
    telefonoLimpio = '51' + telefonoLimpio;
  }

  try {
    if (!cliente_id || !telefono || !mensaje) {
      return res.status(400).json({
        ok: false,
        error: 'cliente_id, telefono y mensaje son requeridos'
      });
    }

    if (!usuarioActual?.id || !usuarioActual?.nombre) {
      return res.status(401).json({
        ok: false,
        error: 'No se pudo identificar al usuario de la sesión'
      });
    }

    if (!/^51\d{9}$/.test(telefonoLimpio)) {
      return res.status(400).json({
        ok: false,
        error: `Número inválido: ${telefono}. Debe tener formato 519XXXXXXXX`
      });
    }

    const [rowsSesion] = await db.query(
      `SELECT
          nombre,
          ultima_interaccion_cliente,
          modo_atencion,
          asesor_nombre
       FROM clientes
       WHERE id = ?
       LIMIT 1`,
      [cliente_id]
    );

    if (rowsSesion.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Cliente no encontrado'
      });
    }

    const clienteSesion = rowsSesion[0];

    // Bloquear el chat si está asignado a otro asesor
    if (
      clienteSesion.modo_atencion === 'asesor' &&
      clienteSesion.asesor_nombre &&
      clienteSesion.asesor_nombre !== usuarioActual.nombre &&
      usuarioActual.rol !== 'admin'
    ) {
      return res.status(403).json({
        ok: false,
        bloqueado: true,
        error: `Este chat está siendo atendido por ${clienteSesion.asesor_nombre}`
      });
    }

    const ultima = clienteSesion.ultima_interaccion_cliente;
    let sesionActiva = false;

    if (ultima) {
      const horasTranscurridas =
        (Date.now() - new Date(ultima).getTime()) / 3600000;

      sesionActiva = horasTranscurridas <= 24;
    }

    if (!sesionActiva) {
      throw {
        response: {
          data: {
            error: {
              code: 131047,
              message: 'Sesión vencida según CRM'
            }
          }
        }
      };
    }

    console.log('ENVIANDO TEXTO LIBRE A META...');

    const respuestaMeta = await axios.post(
      `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: telefonoLimpio,
        type: 'text',
        text: {
          body: mensaje
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const waMessageId =
      respuestaMeta.data.messages?.[0]?.id ?? null;

    // Guardar mensaje normal con autor
    await db.query(
      `INSERT INTO mensajes
       (
         cliente_id,
         telefono,
         mensaje,
         tipo,
         usuario_id,
         usuario_nombre,
         wa_message_id,
         estado_mensaje,
         pendiente
       )
       VALUES (?, ?, ?, 'saliente', ?, ?, ?, 'enviado', 0)`,
      [
        cliente_id,
        telefonoLimpio,
        mensaje,
        usuarioActual.id,
        usuarioActual.nombre,
        waMessageId
      ]
    );

    await db.query(
      `UPDATE clientes
       SET telefono = ?,
           ultimo_mensaje = ?,
           ultimo_tipo = 'saliente',
           fecha_actualizacion = NOW()
       WHERE id = ?`,
      [
        telefonoLimpio,
        mensaje,
        cliente_id
      ]
    );
// =======================================
// AVISAR A N8N QUE EL ASESOR ESCRIBIÓ
// =======================================

// =======================================
// EL ASESOR YA RESPONDIÓ
// QUITAR ALERTA "SOLICITA ASESOR"
// =======================================

if (
  clienteSesion.modo_atencion === 'asesor'
) {

  await db.query(
    `
    UPDATE clientes
    SET
      requiere_asesor = 0,
      fecha_solicitud_asesor = NULL,
      fecha_actualizacion = NOW()
    WHERE id = ?
    `,
    [
      cliente_id
    ]
  );


  // =====================================
  // REINICIAR TEMPORIZADOR DE 10 MINUTOS
  // =====================================

  void notificarActividadAsesorN8n({
    clienteId: cliente_id,
    telefono: telefonoLimpio,
    asesorId: usuarioActual.id,
    asesorNombre: usuarioActual.nombre,
    waMessageId
  });

}
    return res.json({
      ok: true,
      tipo_envio: 'texto',
      messageId: waMessageId,
      autor: usuarioActual.nombre
    });

  } catch (error) {
    const errorMeta = error.response?.data;

    console.log(
      'ERROR META:',
      JSON.stringify(errorMeta || error.message, null, 2)
    );

    const ventanaCerrada =
      errorMeta?.error?.code === 131047 ||
      String(errorMeta?.error?.message || '')
        .toLowerCase()
        .includes('outside') ||
      String(errorMeta?.error?.message || '')
        .toLowerCase()
        .includes('24') ||
      String(errorMeta?.error?.message || '')
        .toLowerCase()
        .includes('sesión vencida');

    if (!ventanaCerrada) {
      return res.status(500).json({
        ok: false,
        error: errorMeta || error.message
      });
    }

    console.log(
      'VENTANA CERRADA DETECTADA. ENVIANDO PLANTILLA...'
    );

    try {
      const [clienteRows] = await db.query(
        `SELECT nombre
         FROM clientes
         WHERE id = ?
         LIMIT 1`,
        [cliente_id]
      );

      const nombreCliente =
        clienteRows[0]?.nombre || 'cliente';

      // Desactivar mensajes pendientes anteriores
      await db.query(
        `UPDATE mensajes
         SET pendiente = 0
         WHERE cliente_id = ?
           AND pendiente = 1`,
        [cliente_id]
      );

      // Guardar mensaje pendiente con autor
      await db.query(
        `INSERT INTO mensajes
         (
           cliente_id,
           telefono,
           mensaje,
           tipo,
           usuario_id,
           usuario_nombre,
           estado_mensaje,
           pendiente
         )
         VALUES (?, ?, ?, 'saliente', ?, ?, 'pendiente', 1)`,
        [
          cliente_id,
          telefonoLimpio,
          mensaje,
          usuarioActual.id,
          usuarioActual.nombre
        ]
      );

      const respuestaPlantilla = await axios.post(
        `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: telefonoLimpio,
          type: 'template',
          template: {
            name: process.env.WHATSAPP_TEMPLATE_REACTIVAR,
            language: {
              code:
                process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es'
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: nombreCliente
                  }
                ]
              }
            ]
          }
        },
        {
          headers: {
            Authorization:
              `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(
        'RESPUESTA PLANTILLA:',
        JSON.stringify(respuestaPlantilla.data, null, 2)
      );

      console.log(
        'PLANTILLA:',
        process.env.WHATSAPP_TEMPLATE_REACTIVAR
      );

      console.log(
        'IDIOMA:',
        process.env.WHATSAPP_TEMPLATE_LANGUAGE
      );

      const waTemplateId =
        respuestaPlantilla.data.messages?.[0]?.id ?? null;

      const textoPlantilla =
        'Plantilla enviada para reactivar conversación.';

      // Guardar registro de plantilla con autor
      await db.query(
        `INSERT INTO mensajes
         (
           cliente_id,
           telefono,
           mensaje,
           tipo,
           usuario_id,
           usuario_nombre,
           wa_message_id,
           estado_mensaje,
           pendiente
         )
         VALUES (?, ?, ?, 'saliente', ?, ?, ?, 'enviado', 0)`,
        [
          cliente_id,
          telefonoLimpio,
          textoPlantilla,
          usuarioActual.id,
          usuarioActual.nombre,
          waTemplateId
        ]
      );

      await db.query(
        `UPDATE clientes
         SET telefono = ?,
             ultimo_mensaje = ?,
             ultimo_tipo = 'saliente',
             fecha_actualizacion = NOW()
         WHERE id = ?`,
        [
          telefonoLimpio,
          textoPlantilla,
          cliente_id
        ]
      );
    await registrarAuditoria(
  req,
  'ENVIAR_MENSAJE',
  'mensajes',
  null,
  {
    cliente_id,
    telefono: telefonoLimpio,
    mensaje,
    wa_message_id: waMessageId
  }
);
      return res.json({
        ok: true,
        tipo_envio: 'plantilla',
        messageId: waTemplateId,
        autor: usuarioActual.nombre
      });

    } catch (errorPlantilla) {
      console.error(
        'ERROR PLANTILLA:',
        errorPlantilla.response?.data ||
        errorPlantilla.message
      );

      return res.status(500).json({
        ok: false,
        error:
          errorPlantilla.response?.data ||
          errorPlantilla.message
      });
    }
  }
});

app.post("/api/mensajes/saliente", async (req, res) => {
  const { telefono, mensaje } = req.body;

  const [cliente] = await db.query(
    "SELECT * FROM clientes WHERE telefono = ?",
    [telefono]
  );

  if (cliente.length === 0) {
    return res.status(404).json({ ok: false, error: "Cliente no encontrado" });
  }

  await db.query(
    "INSERT INTO mensajes (cliente_id, telefono, mensaje, tipo) VALUES (?, ?, ?, 'saliente')",
    [cliente[0].id, telefono, mensaje]
  );
 await db.query(
  `UPDATE clientes
   SET ultimo_mensaje = ?,
       ultimo_tipo = 'saliente',
       fecha_actualizacion = NOW()
   WHERE id = ?`,
  [mensaje, cliente[0].id]
);
  res.json({ ok: true });
});

 

app.post('/webhook/saliente', async (req, res) => {
  try {
    console.log(
      'SALIENTE RECIBIDO:',
      req.body
    );

    let {
      telefono,
      mensaje,
      tipo_media,
      media_url,
      nombre_archivo,
      mime_type,
      wa_message_id
    } = req.body;

    telefono = String(telefono || '')
      .replace(/\D/g, '');

    if (telefono.length === 9) {
      telefono = `51${telefono}`;
    }

    if (!telefono) {
      return res.status(400).json({
        ok: false,
        error: 'Falta teléfono'
      });
    }

    const [cliente] = await db.query(
      `SELECT *
       FROM clientes
       WHERE telefono = ?
       LIMIT 1`,
      [telefono]
    );

    if (cliente.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Cliente no encontrado'
      });
    }

    tipo_media = tipo_media || 'text';

    if (!mensaje) {
      const textos = {
        image: '🖼️ Imagen de producto',
        video: '🎥 Video de producto',
        audio: '🎙️ Audio',
        document: nombre_archivo
          ? `📄 Documento: ${nombre_archivo}`
          : '📄 Documento enviado',
        text: 'Mensaje enviado'
      };

      mensaje =
        textos[tipo_media] ||
        'Archivo enviado';
    }

    await db.query(
      `INSERT INTO mensajes
       (
         cliente_id,
         telefono,
         mensaje,
         tipo,
         tipo_media,
         media_url,
         nombre_archivo,
         mime_type,
         wa_message_id,
         estado_mensaje,
         pendiente
       )
       VALUES
       (?, ?, ?, 'saliente', ?, ?, ?, ?, ?, 'enviado', 0)`,
      [
        cliente[0].id,
        telefono,
        mensaje,
        tipo_media,
        media_url || null,
        nombre_archivo || null,
        mime_type || null,
        wa_message_id || null
      ]
    );

    await db.query(
      `UPDATE clientes
       SET ultimo_mensaje = ?,
           ultimo_tipo = 'saliente',
           fecha_actualizacion = NOW()
       WHERE id = ?`,
      [
        mensaje,
        cliente[0].id
      ]
    );

    return res.json({
      ok: true
    });

  } catch (error) {
    console.error(
      'ERROR AL GUARDAR SALIENTE:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

 
app.post("/guardar-media", async (req, res) => {
  try {
    const mediaId = req.body.media_id;
    const nombreOriginal = req.body.nombre_archivo || "";
    const token = process.env.WHATSAPP_TOKEN;

    if (!mediaId) {
      return res.status(400).json({
        ok: false,
        error: "media_id requerido"
      });
    }

    // Obtener información del archivo
    const mediaInfo = await axios.get(
      `https://graph.facebook.com/v23.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const mediaUrl = mediaInfo.data.url;
    const mimeType = mediaInfo.data.mime_type || "";

    // Descargar archivo
    const archivo = await axios.get(mediaUrl, {
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Detectar extensión
    let extension = path.extname(nombreOriginal);

    if (!extension) {
      switch (mimeType) {
        case "application/pdf":
          extension = ".pdf";
          break;

        case "application/msword":
          extension = ".doc";
          break;

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          extension = ".docx";
          break;

        case "application/vnd.ms-excel":
          extension = ".xls";
          break;

        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
          extension = ".xlsx";
          break;

        case "application/vnd.ms-powerpoint":
          extension = ".ppt";
          break;

        case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
          extension = ".pptx";
          break;

        case "image/jpeg":
          extension = ".jpg";
          break;

        case "image/png":
          extension = ".png";
          break;

        case "image/webp":
          extension = ".webp";
          break;

        case "video/mp4":
          extension = ".mp4";
          break;

        case "audio/ogg":
          extension = ".ogg";
          break;

        case "audio/mpeg":
          extension = ".mp3";
          break;

        default:
          extension = ".bin";
      }
    }

    const nombreSeguro = String(
  path.basename(nombreOriginal, path.extname(nombreOriginal)) ||
  'archivo'
)
  .replace(/[^a-zA-Z0-9-_]/g, '_')
  .substring(0, 80);

const nombreGuardado =
  `${Date.now()}-${nombreSeguro}${extension}`;

    const carpetaDestino = path.join(
      __dirname,
      "public",
      "uploads",
      "whatsapp"
    );

    if (!fs.existsSync(carpetaDestino)) {
      fs.mkdirSync(carpetaDestino, { recursive: true });
    }

   const rutaDestino = path.join(
  carpetaDestino,
  nombreGuardado
);

    const writer = fs.createWriteStream(rutaDestino);

    archivo.data.pipe(writer);

    writer.on("finish", () => {
     res.json({
  ok: true,
  media_url: `/uploads/whatsapp/${nombreGuardado}`,
  mime_type: mimeType,
  nombre_archivo:
    nombreOriginal || nombreGuardado,
  nombre_guardado: nombreGuardado
});
    });

    writer.on("error", () => {
      res.status(500).json({
        ok: false,
        error: "Error al guardar archivo"
      });
    });

  } catch (error) {

    await guardarError(
      "guardar-media",
      error.response?.data || error.message,
      req.body
    );

    console.error(error.response?.data || error.message);

    res.status(500).json({
      ok: false,
      error: "Error al descargar media"
    });

  }
});

app.post('/api/clientes/:id/leido', async (req, res) => {
  try {

    await db.query(
      'UPDATE clientes SET no_leidos = 0 WHERE id = ?',
      [req.params.id]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok:false });
  }
});

async function seleccionarAsesorAutomatico() {

  const [asesores] = await db.query(`
    SELECT
      u.id,
      u.nombre,
      u.peso_asignacion,
      u.max_conversaciones,

      COUNT(
        CASE
          WHEN c.id IS NOT NULL
           AND COALESCE(c.archivado, 0) = 0
          THEN 1
        END
      ) AS conversaciones_asignadas,

      (
        COUNT(
          CASE
            WHEN c.id IS NOT NULL
             AND COALESCE(c.archivado, 0) = 0
            THEN 1
          END
        )
        /
        GREATEST(
          u.peso_asignacion,
          1
        )
      ) AS indice_carga

    FROM usuarios u

    LEFT JOIN clientes c
      ON c.asesor_id = u.id

    WHERE
      u.activo = 1

      AND u.recibe_clientes = 1

      AND LOWER(u.rol)
        IN ('asesor', 'asesora')

    GROUP BY
      u.id,
      u.nombre,
      u.peso_asignacion,
      u.max_conversaciones

    HAVING
      u.max_conversaciones IS NULL

      OR conversaciones_asignadas <
         u.max_conversaciones

    ORDER BY
      indice_carga ASC,
      conversaciones_asignadas ASC,
      u.id ASC

    LIMIT 1
  `);


  return asesores[0] || null;

}



async function asegurarAsesorSeguimiento(
  clienteId
) {

  try {

    // =====================================
    // VER SI YA TIENE ASESOR
    // =====================================

    const [clientes] =
      await db.query(
        `
        SELECT
          id,
          asesor_id,
          asesor_nombre

        FROM clientes

        WHERE id = ?

        LIMIT 1
        `,
        [
          clienteId
        ]
      );


    if (!clientes.length) {
      return null;
    }


    const cliente =
      clientes[0];


    // =====================================
    // YA TIENE RESPONSABLE
    // NO CAMBIARLO
    // =====================================

    if (
      cliente.asesor_id
    ) {

      return {
        id:
          cliente.asesor_id,

        nombre:
          cliente.asesor_nombre
      };

    }


    // =====================================
    // SELECCIONAR ASESOR AUTOMÁTICAMENTE
    // =====================================

    const asesor =
      await seleccionarAsesorAutomatico();


    if (!asesor) {

      console.warn(
        `Cliente ${clienteId} quedó sin asesor: no hay asesores disponibles.`
      );

      return null;

    }


    // =====================================
    // ASIGNARLO
    //
    // IMPORTANTE:
    // NO CAMBIAMOS modo_atencion
    //
    // El BOT sigue funcionando.
    // =====================================

    const [resultado] =
      await db.query(
        `
        UPDATE clientes

        SET
          asesor_id = ?,
          asesor_nombre = ?,
          fecha_actualizacion = NOW()

        WHERE id = ?
          AND asesor_id IS NULL
        `,
        [
          asesor.id,
          asesor.nombre,
          clienteId
        ]
      );


    /*
     * El AND asesor_id IS NULL evita que
     * dos mensajes simultáneos cambien
     * accidentalmente de asesor.
     */


    if (
      resultado.affectedRows > 0
    ) {

      console.log(
        `CLIENTE ${clienteId} ASIGNADO A: ${asesor.nombre}`
      );


      return {
        id:
          asesor.id,

        nombre:
          asesor.nombre
      };

    }


    // =====================================
    // SI OTRO PROCESO YA LO ASIGNÓ
    // RECUPERAR ASIGNACIÓN REAL
    // =====================================

    const [actualizados] =
      await db.query(
        `
        SELECT
          asesor_id,
          asesor_nombre

        FROM clientes

        WHERE id = ?

        LIMIT 1
        `,
        [
          clienteId
        ]
      );


    return {
      id:
        actualizados[0]?.asesor_id ||
        null,

      nombre:
        actualizados[0]?.asesor_nombre ||
        null
    };


  } catch (error) {

    console.error(
      'ERROR ASIGNANDO ASESOR DE SEGUIMIENTO:',
      error
    );


    /*
     * No detenemos el chatbot.
     *
     * Si falla la asignación,
     * el bot debe continuar funcionando.
     */
    return null;

  }

}
 // =======================================
// CAMBIAR MODO DE ATENCIÓN MANUALMENTE
// TOMAR CONVERSACIÓN / VOLVER AL BOT
// =======================================

app.post(
  '/api/clientes/modo-atencion',
  requiereLogin,
  async (req, res) => {

    try {

      // =======================================
      // DATOS
      // =======================================

      let telefono = String(
        req.body.telefono || ''
      ).replace(/\D/g, '');


      const modoAtencion = String(
        req.body.modo_atencion || ''
      )
        .trim()
        .toLowerCase();


      const usuarioActual =
        req.session.usuario;


      // =======================================
      // NORMALIZAR TELÉFONO
      // =======================================

      if (telefono.length === 9) {
        telefono = `51${telefono}`;
      }


      // =======================================
      // VALIDACIONES
      // =======================================

      if (
        !telefono ||
        !modoAtencion
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Teléfono y modo de atención son obligatorios'
        });

      }


      if (
        ![
          'bot',
          'asesor'
        ].includes(
          modoAtencion
        )
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Modo de atención inválido'
        });

      }


      if (
        !usuarioActual?.id ||
        !usuarioActual?.nombre
      ) {

        return res.status(401).json({
          ok: false,
          error:
            'No se pudo identificar al usuario de la sesión'
        });

      }


      // =======================================
      // BUSCAR CLIENTE
      // =======================================

      const [clientes] =
        await db.query(
          `
          SELECT
            id,
            telefono,
            modo_atencion,
            asesor_id,
            asesor_nombre,
            requiere_asesor,
            fecha_solicitud_asesor

          FROM clientes

          WHERE telefono = ?

          LIMIT 1
          `,
          [
            telefono
          ]
        );


      if (!clientes.length) {

        return res.status(404).json({
          ok: false,
          error:
            'Cliente no encontrado'
        });

      }


      const cliente =
        clientes[0];


      // =======================================
      // VALIDAR PROPIEDAD DEL CHAT
      // =======================================

      const esAdministrador =
        String(
          usuarioActual.rol || ''
        )
          .trim()
          .toLowerCase() ===
        'admin';


      const perteneceAOtroAsesor =
        cliente.modo_atencion ===
          'asesor' &&

        cliente.asesor_nombre &&

        cliente.asesor_nombre !==
          usuarioActual.nombre;


      if (
        perteneceAOtroAsesor &&
        !esAdministrador
      ) {

        return res.status(403).json({
          ok: false,
          bloqueado: true,
          error:
            `Esta conversación está asignada a ${cliente.asesor_nombre}`
        });

      }


      // =======================================
      // CONSERVAR SIEMPRE ASESOR ASIGNADO
      // =======================================

      let asesorId =
        cliente.asesor_id ||
        null;


      let asesorNombre =
        cliente.asesor_nombre ||
        null;


      /*
       * Si el cliente todavía NO tiene
       * asesor asignado y alguien pulsa
       * "Tomar conversación",
       * asignamos al usuario actual.
       */
      if (
        modoAtencion ===
          'asesor' &&
        !asesorId
      ) {

        asesorId =
          usuarioActual.id;


        asesorNombre =
          usuarioActual.nombre;

      }


      // =======================================
      // ACTUALIZAR CLIENTE
      //
      // IMPORTANTE:
      //
      // Una acción manual significa que
      // la solicitud pendiente ya fue atendida.
      //
      // requiere_asesor = 0
      // fecha_solicitud_asesor = NULL
      // =======================================

      const [resultado] =
        await db.query(
          `
          UPDATE clientes

          SET

            modo_atencion = ?,

            asesor_id = ?,

            asesor_nombre = ?,

            requiere_asesor = 0,

            fecha_solicitud_asesor = NULL,

            fecha_actualizacion = NOW()

          WHERE id = ?
          `,
          [
            modoAtencion,
            asesorId,
            asesorNombre,
            cliente.id
          ]
        );


      if (
        resultado.affectedRows === 0
      ) {

        return res.status(500).json({
          ok: false,
          error:
            'No se pudo actualizar la conversación'
        });

      }


      // =======================================
      // AUDITORÍA
      // =======================================

      await registrarAuditoria(
        req,

        modoAtencion === 'bot'
          ? 'VOLVER_AL_BOT'
          : 'TOMAR_CONVERSACION',

        'clientes',

        cliente.id,

        {
          telefono,

          modo_atencion:
            modoAtencion,

          asesor_id:
            asesorId,

          asesor_nombre:
            asesorNombre,

          requiere_asesor:
            false
        }
      );


      // =======================================
      // TEMPORIZADOR DE 10 MINUTOS
      // SOLO CUANDO PASA A ASESOR
      // =======================================

      if (
        modoAtencion ===
        'asesor'
      ) {

        void notificarActividadAsesorN8n({

          clienteId:
            cliente.id,

          telefono,

          asesorId,

          asesorNombre,

          waMessageId:
            null

        });

      }


      // =======================================
      // RESPUESTA
      // =======================================

      return res.json({

        ok: true,

        modo_atencion:
          modoAtencion,

        asesor_id:
          asesorId,

        asesor_nombre:
          asesorNombre,

        requiere_asesor:
          false,

        fecha_solicitud_asesor:
          null

      });


    } catch (error) {

      console.error(
        'ERROR CAMBIAR MODO ATENCIÓN:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          error.message ||
          'No se pudo cambiar el modo de atención'
      });

    }

  }
);


// =======================================
// FINALIZAR / ARCHIVAR CONVERSACIÓN
// MANTIENE ASESOR Y DEVUELVE AL BOT
// =======================================

app.post(
  '/api/clientes/:id/finalizar',
  requiereLogin,
  async (req, res) => {

    try {

      // =======================================
      // DATOS
      // =======================================

      const clienteId =
        Number(
          req.params.id
        );


      const usuarioActual =
        req.session.usuario;


      // =======================================
      // VALIDAR CLIENTE
      // =======================================

      if (
        !Number.isInteger(
          clienteId
        ) ||
        clienteId <= 0
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Cliente inválido.'
        });

      }


      // =======================================
      // BUSCAR CLIENTE
      // =======================================

      const [clientes] =
        await db.query(
          `
          SELECT
            id,
            telefono,
            modo_atencion,
            asesor_id,
            asesor_nombre,
            requiere_asesor,
            fecha_solicitud_asesor

          FROM clientes

          WHERE id = ?

          LIMIT 1
          `,
          [
            clienteId
          ]
        );


      if (!clientes.length) {

        return res.status(404).json({
          ok: false,
          error:
            'Cliente no encontrado.'
        });

      }


      const cliente =
        clientes[0];


      // =======================================
      // PERMISOS
      // =======================================

      const esAdmin =
        String(
          usuarioActual?.rol ||
          ''
        )
          .trim()
          .toLowerCase() ===
        'admin';


      /*
       * Solo el asesor responsable
       * o un administrador puede
       * finalizar esta atención.
       */
      if (
        cliente.asesor_id &&

        Number(
          cliente.asesor_id
        ) !==
          Number(
            usuarioActual.id
          ) &&

        !esAdmin
      ) {

        return res.status(403).json({
          ok: false,
          bloqueado: true,
          error:
            `Esta conversación pertenece a ${
              cliente.asesor_nombre ||
              'otro asesor'
            }.`
        });

      }


      // =======================================
      // ARCHIVAR
      //
      // MUY IMPORTANTE:
      //
      // NO modificamos:
      //
      // asesor_id
      // asesor_nombre
      //
      // Por eso el cliente sigue perteneciendo
      // al mismo asesor.
      //
      // Pero limpiamos:
      //
      // requiere_asesor
      // fecha_solicitud_asesor
      // =======================================

      const [resultado] =
        await db.query(
          `
          UPDATE clientes

          SET

            archivado = 1,

            fecha_archivado =
              NOW(),

            modo_atencion =
              'bot',

            requiere_asesor =
              0,

            fecha_solicitud_asesor =
              NULL,

            estado_conversacion =
              'nuevo',

            no_leidos =
              0,

            fecha_actualizacion =
              NOW()

          WHERE id = ?
          `,
          [
            clienteId
          ]
        );


      if (
        resultado.affectedRows === 0
      ) {

        return res.status(500).json({
          ok: false,
          error:
            'No se pudo finalizar la conversación.'
        });

      }


      // =======================================
      // AUDITORÍA
      // =======================================

      await registrarAuditoria(
        req,

        'FINALIZAR_ATENCION',

        'clientes',

        clienteId,

        {
          telefono:
            cliente.telefono,

          asesor_id:
            cliente.asesor_id,

          asesor_nombre:
            cliente.asesor_nombre,

          modo_atencion:
            'bot',

          requiere_asesor:
            false,

          archivado:
            true
        }
      );


      // =======================================
      // RESPUESTA
      // =======================================

      return res.json({

        ok: true,

        cliente_id:
          clienteId,

        archivado:
          true,

        modo_atencion:
          'bot',

        asesor_id:
          cliente.asesor_id,

        asesor_nombre:
          cliente.asesor_nombre,

        requiere_asesor:
          false,

        fecha_solicitud_asesor:
          null

      });


    } catch (error) {

      console.error(
        'ERROR FINALIZANDO ATENCIÓN:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          error.message ||
          'No se pudo finalizar la atención.'
      });

    }

  }
);

function requiereLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado'
    });
  }

  next();
}

// =======================================
// SISTEMA GENERAL DE PERMISOS
// =======================================

function normalizarPermisosBackend(permisos) {
  if (!permisos) {
    return {};
  }

  if (
    typeof permisos === 'object' &&
    !Buffer.isBuffer(permisos)
  ) {
    return permisos;
  }

  try {
    return JSON.parse(
      Buffer.isBuffer(permisos)
        ? permisos.toString('utf8')
        : String(permisos)
    );
  } catch (error) {
    console.error(
      'No se pudieron interpretar los permisos:',
      error.message
    );

    return {};
  }
}

async function cargarUsuarioSesionCompleto(req) {
  const usuarioId =
    Number(req.session?.usuario?.id);

  if (!usuarioId) {
    return null;
  }

  const [usuarios] = await db.query(
    `
    SELECT
      id,
      nombre,
      usuario,
      rol,
      activo,
      foto_url,
      permisos,
      perfil_permisos
    FROM usuarios
    WHERE id = ?
    LIMIT 1
    `,
    [usuarioId]
  );

  if (!usuarios.length) {
    return null;
  }

  const usuario = usuarios[0];

  usuario.permisos =
    normalizarPermisosBackend(
      usuario.permisos
    );

  return usuario;
}

function obtenerNivelPermisoBackend(
  usuario,
  modulo,
  accion
) {
  if (!usuario) {
    return 'denegado';
  }

  const rol = String(
    usuario.rol || ''
  )
    .trim()
    .toLowerCase();

  if (rol === 'admin') {
    return 'permitido';
  }

  const permisos =
    normalizarPermisosBackend(
      usuario.permisos
    );

  return (
    permisos?.[modulo]?.[accion] ||
    'denegado'
  );
}

function tienePermisoBackend(
  usuario,
  modulo,
  accion
) {
  const nivel =
    obtenerNivelPermisoBackend(
      usuario,
      modulo,
      accion
    );

  return [
    'permitido',
    'equipo',
    'responsable',
    'propios'
  ].includes(nivel);
}

function requierePermiso(
  modulo,
  accion
) {
  return async function (
    req,
    res,
    next
  ) {
    try {
      if (!req.session?.usuario?.id) {
        return res.status(401).json({
          ok: false,
          error: 'No autorizado'
        });
      }

      const usuario =
        await cargarUsuarioSesionCompleto(req);

      if (!usuario) {
        return res.status(401).json({
          ok: false,
          error:
            'Usuario no encontrado.'
        });
      }

      if (Number(usuario.activo) !== 1) {
        return res.status(403).json({
          ok: false,
          error:
            'Usuario inactivo.'
        });
      }

      if (
        !tienePermisoBackend(
          usuario,
          modulo,
          accion
        )
      ) {
        return res.status(403).json({
          ok: false,
          error:
            'No tienes permiso para realizar esta acción.'
        });
      }

      req.usuarioPermisos = usuario;

      next();

    } catch (error) {
      console.error(
        'ERROR VALIDANDO PERMISO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          'No se pudo validar el permiso.'
      });
    }
  };
}

function requiereCajaOAdmin(req, res, next) {
  const usuario = req.session?.usuario;

  if (!usuario) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado'
    });
  }

  const rol = String(
    usuario.rol || ''
  )
    .trim()
    .toLowerCase();

  if (!['admin', 'caja'].includes(rol)) {
    return res.status(403).json({
      ok: false,
      error:
        'Solo Caja o el administrador pueden verificar pagos'
    });
  }

  next();
}

async function enviarMensajePagoWhatsApp({
  telefono,
  mensaje
}) {
  const telefonoLimpio = String(
    telefono || ''
  ).replace(/\D/g, '');

  if (!telefonoLimpio || !mensaje) {
    throw new Error(
      'Teléfono y mensaje son obligatorios'
    );
  }

  const respuesta = await axios.post(
    `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefonoLimpio,
      type: 'text',
      text: {
        preview_url: false,
        body: mensaje
      }
    },
    {
      headers: {
        Authorization:
          `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );

  return respuesta.data.messages?.[0]?.id || null;
}
// =======================================
// CAJA, PEDIDOS, FACTURACIÓN Y ETIQUETAS
// =======================================

const MEDIOS_PAGO_VALIDOS = new Set([
  'yape',
  'plin',
  'transferencia',
  'tarjeta_pos',
  'efectivo',
  'deposito',
  'otro'
]);

function parsearJsonSeguro(valor, respaldo = []) {
  if (Array.isArray(valor)) {
    return valor;
  }

  if (valor && typeof valor === 'object') {
    return valor;
  }

  const texto = String(valor || '').trim();

  if (!texto) {
    return respaldo;
  }

  try {
    return JSON.parse(texto);
  } catch (error) {
    return respaldo;
  }
}

function numeroSeguro(valor) {
  const numero = Number(valor || 0);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function textoSeguroArchivo(valor) {
  return String(valor || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 110);
}


function obtenerItemsDesdePago(pago) {
  let items = parsearJsonSeguro(
    pago.items_compra,
    []
  );

  if (!Array.isArray(items)) {
    items = [];
  }

  let normalizados = items
    .map(item => {
      const nombre = String(
        item.producto ||
        item.nombre_producto ||
        item.nombre ||
        ''
      ).trim();

      const sku = String(
        item.sku || ''
      ).trim();

      const cantidad = Math.max(
        1,
        Number(item.cantidad || 1)
      );

      const precio = numeroSeguro(
        item.precio ??
        item.precio_unitario
      );

      const subtotal =
        numeroSeguro(item.subtotal) ||
        precio * cantidad;

      return {
        nombre,
        sku,
        cantidad,
        precio,
        subtotal
      };
    })
    .filter(item => item.nombre);

  if (
    !normalizados.length &&
    pago.ultimo_producto_nombre
  ) {
    const cantidad = Math.max(
      1,
      Number(
        pago.cantidad_pendiente || 1
      )
    );

    const precio = numeroSeguro(
      pago.ultimo_producto_precio
    );

    normalizados = [{
      nombre: String(
        pago.ultimo_producto_nombre
      ).trim(),

      sku: String(
        pago.ultimo_producto_sku || ''
      ).trim(),

      cantidad,
      precio,
      subtotal: cantidad * precio
    }];
  }

  return normalizados;
}

async function crearPedidoDesdePago({
  pago,
  medioPagoConfirmado,
  usuario
}) {
  const [existentes] = await db.query(
    `
    SELECT
      id,
      codigo
    FROM pedidos
    WHERE pago_id = ?
    LIMIT 1
    `,
    [pago.id]
  );

  if (existentes.length) {
    return existentes[0];
  }

  const items = obtenerItemsDesdePago(pago);

  const subtotalCalculado = items.reduce(
    (total, item) =>
      total + numeroSeguro(item.subtotal),
    0
  );

  const subtotalProductos =
    numeroSeguro(
      pago.subtotal_productos
    ) ||
    subtotalCalculado;

  const costoDelivery =
    numeroSeguro(
      pago.costo_delivery
    );

  const total =
    numeroSeguro(
      pago.total_compra
    ) ||
    numeroSeguro(
      pago.monto
    ) ||
    numeroSeguro(
      pago.total_pedido
    ) ||
    subtotalProductos + costoDelivery;

  const [resultado] = await db.query(
    `
    INSERT INTO pedidos (
      pago_id,
      cliente_id,

      cliente_nombre,
      tipo_documento,
      numero_documento,
      correo,
      telefono,

      tipo_entrega,
      direccion,
      referencia,
      distrito,
      ciudad,
      departamento,
      agencia,

      subtotal_productos,
      costo_delivery,
      total,

      medio_pago_confirmado,

      estado_pedido,
      estado_facturacion,

      aprobado_por,
      aprobado_por_nombre,
      fecha_pago
    )
    VALUES (
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?,
      'pendiente_facturacion',
      'pendiente',
      ?, ?, NOW()
    )
    `,
    [
      pago.id,
      pago.cliente_id,

      pago.cliente_nombre ||
        'Cliente',

      pago.documento_tipo ||
        null,

      pago.documento_numero ||
        null,

      pago.correo ||
        null,

      pago.telefono,

      pago.tipo_entrega ||
        null,

      pago.direccion ||
        null,

      pago.referencia ||
        null,

      pago.distrito ||
        null,

      pago.ciudad ||
        null,

      pago.departamento ||
        null,

      pago.agencia ||
        null,

      subtotalProductos,
      costoDelivery,
      total,

      medioPagoConfirmado,

      usuario?.id || null,
      usuario?.nombre || null
    ]
  );

  const pedidoId = resultado.insertId;

  const codigo =
    `PED-${String(
      pedidoId
    ).padStart(6, '0')}`;

  await db.query(
    `
    UPDATE pedidos
    SET codigo = ?
    WHERE id = ?
    `,
    [
      codigo,
      pedidoId
    ]
  );

  for (const item of items) {
    await db.query(
      `
      INSERT INTO pedido_items (
        pedido_id,
        sku,
        nombre_producto,
        cantidad,
        precio_unitario,
        subtotal
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        pedidoId,
        item.sku || null,
        item.nombre,
        item.cantidad,
        item.precio,
        item.subtotal
      ]
    );
  }

  return {
    id: pedidoId,
    codigo
  };
}

function obtenerDirectorioFacturacion() {
  const carpeta = path.join(
    __dirname,
    'public',
    'uploads',
    'facturacion'
  );

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(
      carpeta,
      {
        recursive: true
      }
    );
  }

  return carpeta;
}

function moverArchivoFacturacion({
  archivo,
  pedidoId,
  tipo
}) {
  if (!archivo) {
    return null;
  }

  const extension =
    path.extname(
      archivo.originalname || ''
    ).toLowerCase();

  const base =
    textoSeguroArchivo(
      path.basename(
        archivo.originalname || tipo,
        extension
      )
    ) ||
    tipo;

  const nombre =
    `${Date.now()}-pedido-${pedidoId}-${tipo}-${base}${extension}`;

  const destino = path.join(
    obtenerDirectorioFacturacion(),
    nombre
  );

  try {
    fs.renameSync(
      archivo.path,
      destino
    );
  } catch (error) {
    fs.copyFileSync(
      archivo.path,
      destino
    );

    fs.unlinkSync(
      archivo.path
    );
  }

  return (
    `/uploads/facturacion/${nombre}`
  );
}

function rutaPublicaAArchivo(url) {
  const limpia = String(url || '')
    .split('?')[0]
    .replace(/^\/+/, '');

  if (!limpia) {
    return null;
  }

  const ruta = path.join(
    __dirname,
    'public',
    limpia
  );

  return fs.existsSync(ruta)
    ? ruta
    : null;
}

function obtenerNodemailer() {
  try {
    return require('nodemailer');
  } catch (error) {
    throw new Error(
      'Falta instalar nodemailer. Ejecuta: npm install nodemailer'
    );
  }
}

function crearTransportadorCorreo() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'Configura SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en el archivo .env.'
    );
  }

  const nodemailer =
    obtenerNodemailer();

  const port = Number(
    process.env.SMTP_PORT || 587
  );

  return nodemailer.createTransport({
    host,
    port,

    secure:
      String(
        process.env.SMTP_SECURE || ''
      ).toLowerCase() === 'true' ||
      port === 465,

    auth: {
      user,
      pass
    }
  });
}

async function obtenerPedidoCompleto(pedidoId) {
  const [pedidos] = await db.query(
    `
    SELECT *
    FROM pedidos
    WHERE id = ?
    LIMIT 1
    `,
    [pedidoId]
  );

  if (!pedidos.length) {
    return null;
  }

  const pedido = pedidos[0];

  const [items] = await db.query(
    `
    SELECT
      id,
      sku,
      nombre_producto,
      cantidad,
      precio_unitario,
      subtotal
    FROM pedido_items
    WHERE pedido_id = ?
    ORDER BY id ASC
    `,
    [pedidoId]
  );

  pedido.items = items;

  return pedido;
}

async function enviarCorreoFacturacion(pedido) {
  if (!pedido) {
    throw new Error(
      'Pedido no encontrado.'
    );
  }

  const correo = String(
    pedido.correo || ''
  ).trim();

  if (!correo) {
    throw new Error(
      'El pedido no tiene correo registrado.'
    );
  }

  const adjuntos = [];

  const pdf = rutaPublicaAArchivo(
    pedido.factura_pdf_url
  );

  const xml = rutaPublicaAArchivo(
    pedido.factura_xml_url
  );

  if (pdf) {
    adjuntos.push({
      filename: path.basename(pdf),
      path: pdf
    });
  }

  if (xml) {
    adjuntos.push({
      filename: path.basename(xml),
      path: xml
    });
  }

  if (!adjuntos.length) {
    throw new Error(
      'No hay PDF o XML de facturación para enviar.'
    );
  }

  const transportador =
    crearTransportadorCorreo();

  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER;

  const total = numeroSeguro(
    pedido.total
  ).toFixed(2);

  const codigo =
    pedido.codigo ||
    `PED-${pedido.id}`;

  const respuesta =
    await transportador.sendMail({
      from,
      to: correo,

      subject:
        `Comprobante electrónico ZR MEDIC - ${codigo}`,

      text:
`Hola ${pedido.cliente_nombre || 'cliente'},

Gracias por tu compra en ZR MEDIC.

Adjuntamos el comprobante electrónico correspondiente al pedido ${codigo}.
Total del pedido: S/ ${total}

Atentamente,
ZR MEDIC`,

      html:
        `
        <div style="font-family:Arial,sans-serif;color:#243a36;line-height:1.55">
          <h2 style="color:#087b71;margin-bottom:8px">
            ZR MEDIC
          </h2>

          <p>
            Hola
            <strong>
              ${String(
                pedido.cliente_nombre ||
                'cliente'
              )}
            </strong>,
          </p>

          <p>
            Gracias por tu compra.
            Adjuntamos el comprobante electrónico correspondiente al pedido
            <strong>${codigo}</strong>.
          </p>

          <p>
            <strong>Total:</strong>
            S/ ${total}
          </p>

          <p style="color:#667a75">
            Este correo fue generado automáticamente por el sistema comercial de ZR MEDIC.
          </p>
        </div>
        `,

      attachments: adjuntos
    });

  return respuesta.messageId;
}
// =======================================
// LISTAR COMPROBANTES PENDIENTES
// SOLO ADMIN Y CAJA
// =======================================

app.get(
  '/api/pagos/pendientes',
  requiereCajaOAdmin,
  async (req, res) => {
    try {
 const [pagos] = await db.query(`
  SELECT
 p.id,
p.cliente_id,

COALESCE(
  NULLIF(p.cliente_nombre, ''),
  c.nombre
) AS cliente_nombre,

p.telefono,

COALESCE(
  NULLIF(p.documento_tipo, ''),
  c.documento_tipo
) AS documento_tipo,

COALESCE(
  NULLIF(p.documento_numero, ''),
  c.documento_numero
) AS documento_numero,

COALESCE(
  NULLIF(p.tipo_entrega, ''),
  c.tipo_entrega
) AS tipo_entrega,

COALESCE(
  NULLIF(p.direccion_entrega, ''),
  c.direccion
) AS direccion,

c.referencia,

COALESCE(
  NULLIF(p.distrito_entrega, ''),
  c.distrito
) AS distrito,

c.ciudad,
c.departamento,
c.agencia,

    c.ultimo_producto_nombre,
    c.ultimo_producto_sku,
    c.ultimo_producto_precio,
    c.cantidad_pendiente,
    c.total_pedido,

    p.monto,
    p.medio_pago,
    p.comprobante_url,
    p.comprobante_tipo,
    p.nombre_archivo,
    p.estado,
    p.fecha_creacion,
    p.items_compra,
p.tipo_entrega AS pago_tipo_entrega,
p.direccion_entrega,
p.distrito_entrega,
p.costo_delivery,
p.subtotal_productos,
p.total_compra,
p.medio_pago_confirmado

  FROM pagos p
  INNER JOIN clientes c
    ON c.id = p.cliente_id
  WHERE p.estado = 'pendiente_verificacion'
  ORDER BY p.fecha_creacion ASC
`);

      return res.json({
        ok: true,
        pagos
      });

    } catch (error) {
      console.error(
        'ERROR LISTANDO PAGOS PENDIENTES:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);
 
app.post(
  '/api/n8n/pagos/comprobante',
  requiereApiN8n,
  async (req, res) => {
    try {

      // ==========================================
      // TELÉFONO
      // ==========================================

      let telefono = String(
        req.body.telefono || ''
      ).replace(/\D/g, '');

      if (telefono.length === 9) {
        telefono = `51${telefono}`;
      }

      // ==========================================
      // DATOS DEL PAGO
      // ==========================================

      const monto = Number(
        req.body.monto || 0
      );

      const medioPago = String(
        req.body.medio_pago ||
        'no_especificado'
      ).trim();

      const comprobanteUrl = String(
        req.body.comprobante_url || ''
      ).trim();

      const comprobanteTipo = String(
        req.body.comprobante_tipo ||
        'image'
      ).trim();

      const nombreArchivo = String(
        req.body.nombre_archivo || ''
      ).trim();

      // ==========================================
      // DATOS DE LA COMPRA
      // ==========================================

      const itemsCompra =
        Array.isArray(req.body.items_compra)
          ? req.body.items_compra
          : [];

      const tipoEntrega = String(
        req.body.tipo_entrega || ''
      ).trim();

      const direccionEntrega = String(
        req.body.direccion_entrega || ''
      ).trim();

      const distritoEntrega = String(
        req.body.distrito_entrega || ''
      ).trim();

      const costoDelivery = Number(
        req.body.costo_delivery || 0
      );

      const subtotalProductos = Number(
        req.body.subtotal_productos || 0
      );

      const totalCompra = Number(
        req.body.total_compra ||
        req.body.monto ||
        0
      );

      // ==========================================
      // VALIDACIONES
      // ==========================================

      if (!telefono) {
        return res.status(400).json({
          ok: false,
          error:
            'El teléfono es obligatorio'
        });
      }

      if (!comprobanteUrl) {
        return res.status(400).json({
          ok: false,
          error:
            'La URL del comprobante es obligatoria'
        });
      }

      // ==========================================
      // BUSCAR CLIENTE
      // ==========================================

      const [clientes] = await db.query(
        `
        SELECT
  id,
  nombre,
  documento_tipo,
  documento_numero
FROM clientes
        WHERE telefono = ?
        LIMIT 1
        `,
        [telefono]
      );

      if (!clientes.length) {
        return res.status(404).json({
          ok: false,
          error:
            'Cliente no encontrado'
        });
      }

      const cliente = clientes[0];
      const clienteNombre = String(
  req.body.cliente_nombre ||
  cliente.nombre ||
  'Cliente'
).trim();

const documentoTipo = String(
  req.body.documento_tipo ||
  cliente.documento_tipo ||
  ''
)
  .trim()
  .toUpperCase();

const documentoNumero = String(
  req.body.documento_numero ||
  cliente.documento_numero ||
  ''
).replace(/\D/g, '');
      // ==========================================
      // EVITAR COMPROBANTE DUPLICADO
      // ==========================================

      const [duplicados] =
        await db.query(
          `
          SELECT id
          FROM pagos
          WHERE cliente_id = ?
            AND comprobante_url = ?
            AND estado IN (
              'pendiente_verificacion',
              'pago_aprobado'
            )
          LIMIT 1
          `,
          [
            cliente.id,
            comprobanteUrl
          ]
        );

      if (duplicados.length) {
        return res.json({
          ok: true,
          duplicado: true,
          pago_id:
            duplicados[0].id
        });
      }

      // ==========================================
      // GUARDAR COMPROBANTE
      // ==========================================

      const [resultado] =
        await db.query(
          `
          INSERT INTO pagos (
            cliente_id,
            telefono,
           cliente_nombre,
documento_tipo,
documento_numero,
            monto,
            medio_pago,

            comprobante_url,
            comprobante_tipo,
            nombre_archivo,

            items_compra,
            tipo_entrega,
            direccion_entrega,
            distrito_entrega,
            costo_delivery,
            subtotal_productos,
            total_compra,

            estado
          )
           VALUES (
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      'pendiente_verificacion'
    )
          `,
       [
      cliente.id,
      telefono,

      clienteNombre,
      documentoTipo || null,
      documentoNumero || null,

      monto,
      medioPago,

      comprobanteUrl,
      comprobanteTipo,
      nombreArchivo || null,

      JSON.stringify(itemsCompra),

      tipoEntrega || null,
      direccionEntrega || null,
      distritoEntrega || null,

      costoDelivery,
      subtotalProductos,
      totalCompra
    ]
        );

      // ==========================================
      // ACTUALIZAR CLIENTE
      // ==========================================

      await db.query(
        `
        UPDATE clientes
        SET
          estado_pago =
            'pendiente_verificacion',

          pago_id_actual = ?,

          etapa_embudo =
            'VALIDAR_PAGO',

          fecha_ultimo_movimiento =
            NOW(),

          fecha_actualizacion =
            NOW()

        WHERE id = ?
        `,
        [
          resultado.insertId,
          cliente.id
        ]
      );

      // ==========================================
      // RESPUESTA A N8N
      // ==========================================

      return res.json({
        ok: true,

        pago_id:
          resultado.insertId,

        cliente_id:
          cliente.id,

        estado:
          'pendiente_verificacion',

        monto,
        medio_pago:
          medioPago,

        total_compra:
          totalCompra,

        items_compra:
          itemsCompra
      });

    } catch (error) {

      console.error(
        'ERROR REGISTRANDO COMPROBANTE:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);
app.patch(
  '/api/pagos/:id/aprobar',
  requiereCajaOAdmin,
  async (req, res) => {
    try {
      // ==========================================
      // 1. DATOS INICIALES
      // ==========================================

      const pagoId =
        Number(req.params.id);

      const usuario =
        req.session.usuario;

      const medioPagoConfirmado =
        String(
          req.body.medio_pago_confirmado ||
          ''
        )
          .trim()
          .toLowerCase();


      // ==========================================
      // 2. VALIDAR ID DEL PAGO
      // ==========================================

      if (
        !Number.isInteger(pagoId) ||
        pagoId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'ID de pago inválido'
        });
      }


      // ==========================================
      // 3. VALIDAR MEDIO DE PAGO
      // ==========================================

      if (
        !MEDIOS_PAGO_VALIDOS.has(
          medioPagoConfirmado
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'Selecciona un método de pago válido antes de aprobar.'
        });
      }


      // ==========================================
      // 4. BUSCAR PAGO + DATOS DEL CLIENTE
      // ==========================================

      const [pagos] =
        await db.query(
          `
          SELECT
            p.id,
            p.cliente_id,
            p.telefono,

            p.monto,
            p.medio_pago,
            p.medio_pago_confirmado,
            p.estado,

            p.items_compra,
            p.subtotal_productos,
            p.costo_delivery,
            p.total_compra,

            COALESCE(
              NULLIF(
                p.tipo_entrega,
                ''
              ),
              c.tipo_entrega
            ) AS tipo_entrega,

            COALESCE(
              NULLIF(
                p.direccion_entrega,
                ''
              ),
              c.direccion
            ) AS direccion,

            c.referencia,

            COALESCE(
              NULLIF(
                p.distrito_entrega,
                ''
              ),
              c.distrito
            ) AS distrito,

            c.ciudad,
            c.departamento,
            c.agencia,

         COALESCE(
  NULLIF(p.cliente_nombre, ''),
  c.nombre
) AS cliente_nombre,

COALESCE(
  NULLIF(p.documento_tipo, ''),
  c.documento_tipo
) AS documento_tipo,

COALESCE(
  NULLIF(p.documento_numero, ''),
  c.documento_numero
) AS documento_numero,

            c.correo,

            c.ultimo_producto_nombre,
            c.ultimo_producto_sku,
            c.ultimo_producto_precio,
            c.cantidad_pendiente,
            c.total_pedido

          FROM pagos p

          INNER JOIN clientes c
            ON c.id =
              p.cliente_id

          WHERE p.id = ?

          LIMIT 1
          `,
          [
            pagoId
          ]
        );


      // ==========================================
      // 5. VALIDAR QUE EXISTA
      // ==========================================

      if (!pagos.length) {
        return res.status(404).json({
          ok: false,
          error:
            'Pago no encontrado'
        });
      }

      const pago =
        pagos[0];


      // ==========================================
      // 6. EVITAR APROBAR DOS VECES
      // ==========================================

      if (
        pago.estado !==
        'pendiente_verificacion'
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'Este comprobante ya fue revisado'
        });
      }


      // ==========================================
      // 7. OBTENER PRIMER NOMBRE
      // ==========================================

      function obtenerPrimerNombre(
        nombreCompleto
      ) {
        const nombre =
          String(
            nombreCompleto || ''
          ).trim();

        if (!nombre) {
          return 'Cliente';
        }

        /*
         * Ejemplo:
         *
         * SOTELO QUISPE, ISRAEL JULIO
         *
         * devuelve:
         *
         * Israel
         */

        if (nombre.includes(',')) {

          const nombres =
            nombre
              .split(',')
              .slice(1)
              .join(' ')
              .trim();

          const primero =
            nombres
              .split(/\s+/)
              .filter(Boolean)[0];

          if (primero) {
            return (
              primero
                .charAt(0)
                .toUpperCase() +

              primero
                .slice(1)
                .toLowerCase()
            );
          }
        }

        const primero =
          nombre
            .split(/\s+/)
            .filter(Boolean)[0] ||
          'Cliente';

        return (
          primero
            .charAt(0)
            .toUpperCase() +

          primero
            .slice(1)
            .toLowerCase()
        );
      }


      const primerNombre =
        obtenerPrimerNombre(
          pago.cliente_nombre
        );


      const tipoEntrega =
        String(
          pago.tipo_entrega || ''
        )
          .trim()
          .toLowerCase();


      // ==========================================
      // 8. CREAR PEDIDO ANTES DE APROBAR PAGO
      // ==========================================

      /*
       * MUY IMPORTANTE:
       *
       * Primero intentamos crear el pedido.
       *
       * Si ocurre un error aquí,
       * el pago seguirá como
       * pendiente_verificacion.
       *
       * De esa manera Caja puede
       * volver a intentar.
       */

      const pedido =
        await crearPedidoDesdePago({
          pago,
          medioPagoConfirmado,
          usuario
        });


      // ==========================================
      // 9. APROBAR PAGO
      // ==========================================

      await db.query(
        `
        UPDATE pagos
        SET

          estado =
            'pago_aprobado',

          medio_pago_confirmado = ?,

          observacion = NULL,

          verificado_por = ?,

          verificado_por_nombre = ?,

          fecha_verificacion =
            NOW()

        WHERE id = ?
        `,
        [
          medioPagoConfirmado,

          usuario.id,

          usuario.nombre,

          pagoId
        ]
      );


      // ==========================================
      // 10. ACTUALIZAR CLIENTE
      // ==========================================

      await db.query(
        `
        UPDATE clientes
        SET

          estado_pago =
            'pago_aprobado',

          etapa_embudo =
            'PAGO_CONFIRMADO',

          fecha_ultimo_movimiento =
            NOW(),

          fecha_actualizacion =
            NOW()

        WHERE id = ?
        `,
        [
          pago.cliente_id
        ]
      );


      // ==========================================
      // 11. PREPARAR MENSAJE WHATSAPP
      // ==========================================

      let mensajeConfirmacion =
        '';


      // ------------------------------------------
      // RECOJO EN TIENDA
      // ------------------------------------------

      if (
        tipoEntrega ===
        'recojo'
      ) {

        mensajeConfirmacion =
`🎉 ¡Excelente, ${primerNombre}! Tu pago fue verificado correctamente y tu compra ha sido confirmada.

🏪 *Tu pedido será preparado para recojo en nuestra tienda.*

📍 *ZR MEDIC - Av. Tacna*
📌 Av. Tacna 582, Cercado de Lima
🕘 Lunes a sábado, de 9:00 a. m. a 6:00 p. m.

🧾 *Tu factura*
Una vez emitida, será enviada al correo electrónico registrado y también la recibirás físicamente al momento del recojo.

😊 Muchas gracias por tu compra y por confiar en *ZR MEDIC*.
¡Te esperamos!`;

      } else {

        // ------------------------------------------
        // DELIVERY / PROVINCIA
        // ------------------------------------------

        mensajeConfirmacion =
`🎉 ¡Excelente, ${primerNombre}! Tu pago fue verificado correctamente y tu compra ha sido confirmada.

📦 *Nuestro equipo continuará con la preparación de tu pedido.*

🧾 *Tu factura*
Una vez emitida, será enviada al correo electrónico registrado y también será entregada junto con tu pedido.

😊 Muchas gracias por tu compra y por confiar en *ZR MEDIC*.
¡Pronto recibirás novedades sobre tu pedido!`;

      }


      // ==========================================
      // 12. ENVIAR WHATSAPP
      // ==========================================

      let waMessageId =
        null;

      let mensajeEnviado =
        false;


      try {

        waMessageId =
          await enviarMensajePagoWhatsApp({
            telefono:
              pago.telefono,

            mensaje:
              mensajeConfirmacion
          });


        mensajeEnviado =
          true;


        // ==========================================
        // GUARDAR MENSAJE EN CRM
        // ==========================================

        await db.query(
          `
          INSERT INTO mensajes (
            cliente_id,
            telefono,
            mensaje,
            tipo,
            tipo_media,
            wa_message_id,
            estado_mensaje,
            pendiente
          )
          VALUES (
            ?, ?, ?,
            'saliente',
            'text',
            ?,
            'enviado',
            0
          )
          `,
          [
            pago.cliente_id,

            pago.telefono,

            mensajeConfirmacion,

            waMessageId
          ]
        );


      } catch (errorEnvio) {

        /*
         * El pago YA está aprobado.
         *
         * Por eso un error de WhatsApp
         * NO debe cancelar la aprobación.
         */

        console.error(
          'PAGO APROBADO, PERO NO SE PUDO NOTIFICAR:',
          errorEnvio.response?.data ||
          errorEnvio.message
        );

      }


      // ==========================================
      // 13. FINALIZAR ESTADO DEL CLIENTE
      // ==========================================

      await db.query(
        `
        UPDATE clientes
        SET

          estado_pago =
            'pago_aprobado',

          estado_conversacion =
            'compra_finalizada',

          etapa_embudo =
            'PAGO_CONFIRMADO',

          fecha_ultimo_movimiento =
            NOW(),

          fecha_actualizacion =
            NOW()

        WHERE id = ?
        `,
        [
          pago.cliente_id
        ]
      );


      // ==========================================
      // 14. AUDITORÍA
      // ==========================================

      await registrarAuditoria(
        req,

        'APROBAR_PAGO',

        'pagos',

        pagoId,

        {
          medio_pago_original:
            pago.medio_pago,

          medio_pago_confirmado:
            medioPagoConfirmado,

          pedido_id:
            pedido.id,

          pedido_codigo:
            pedido.codigo
        }
      );


      // ==========================================
      // 15. RESPUESTA AL FRONTEND
      // ==========================================

      return res.json({
        ok: true,

        pago_id:
          pagoId,

        estado:
          'pago_aprobado',

        medio_pago_confirmado:
          medioPagoConfirmado,

        pedido_id:
          pedido.id,

        pedido_codigo:
          pedido.codigo,

        telefono:
          pago.telefono,

        mensaje_enviado:
          mensajeEnviado,

        wa_message_id:
          waMessageId
      });


    } catch (error) {

      console.error(
        'ERROR APROBANDO PAGO:',
        error
      );


      return res.status(500).json({
        ok: false,

        error:
          error.message
      });
    }
  }
);

app.patch(
  '/api/pagos/:id/rechazar',
  requiereCajaOAdmin,
  async (req, res) => {
    try {
      const pagoId = Number(req.params.id);

      const observacion = String(
        req.body.observacion || ''
      ).trim();

      const usuario = req.session.usuario;

      if (!Number.isInteger(pagoId) || pagoId <= 0) {
        return res.status(400).json({
          ok: false,
          error: 'ID de pago inválido'
        });
      }

      if (!observacion) {
        return res.status(400).json({
          ok: false,
          error: 'Debes indicar el motivo del rechazo'
        });
      }

      const [pagos] = await db.query(
        `
        SELECT
          id,
          cliente_id,
          telefono,
          estado
        FROM pagos
        WHERE id = ?
        LIMIT 1
        `,
        [pagoId]
      );

      if (!pagos.length) {
        return res.status(404).json({
          ok: false,
          error: 'Pago no encontrado'
        });
      }

      const pago = pagos[0];

      if (pago.estado !== 'pendiente_verificacion') {
        return res.status(400).json({
          ok: false,
          error: 'Este comprobante ya fue revisado'
        });
      }

      await db.query(
        `
        UPDATE pagos
        SET
          estado = 'pago_rechazado',
          observacion = ?,
          verificado_por = ?,
          verificado_por_nombre = ?,
          fecha_verificacion = NOW()
        WHERE id = ?
        `,
        [
          observacion,
          usuario.id,
          usuario.nombre,
          pagoId
        ]
      );

 await db.query(
  `
  UPDATE clientes
  SET
    estado_pago = 'pago_rechazado',
    etapa_embudo = 'PAGO_NO_CONFIRMADO',
    fecha_ultimo_movimiento = NOW(),
    fecha_actualizacion = NOW()
  WHERE id = ?
  `,
  [pago.cliente_id]
);
      const mensajeRechazo =
`⚠️ *NO PUDIMOS VALIDAR TU COMPROBANTE*

Motivo:
${observacion}

Por favor, verifica que sean visibles:

• El monto pagado
• La fecha y hora
• El número de operación
• El destinatario

Envíanos nuevamente el comprobante correcto.`;

let waMessageId = null;
let mensajeEnviado = false;

try {
  waMessageId = await enviarMensajePagoWhatsApp({
    telefono: pago.telefono,
    mensaje: mensajeRechazo
  });

  mensajeEnviado = true;

  await db.query(
    `
    INSERT INTO mensajes (
      cliente_id,
      telefono,
      mensaje,
      tipo,
      tipo_media,
      wa_message_id,
      estado_mensaje,
      pendiente
    )
    VALUES (
      ?, ?, ?, 'saliente', 'text', ?,
      'enviado', 0
    )
    `,
    [
      pago.cliente_id,
      pago.telefono,
      mensajeRechazo,
      waMessageId
    ]
  );

} catch (errorEnvio) {
  console.error(
    'PAGO RECHAZADO, PERO NO SE PUDO NOTIFICAR:',
    errorEnvio.response?.data ||
    errorEnvio.message
  );
}
      return res.json({
  ok: true,
  pago_id: pagoId,
  estado: 'pago_rechazado',
  telefono: pago.telefono,
  mensaje_enviado: mensajeEnviado,
  wa_message_id: waMessageId
});

    } catch (error) {
      console.error(
        'ERROR RECHAZANDO PAGO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);
app.post('/webhook/estado-mensaje', async (req, res) => {
  try {
   const { wa_message_id, estado, error } = req.body;

    console.log("ESTADO RECIBIDO:", req.body);
if (estado === 'failed') {
  console.log("ERROR DE META EN PLANTILLA:", error);
}
    if (!wa_message_id || !estado) {
      return res.status(400).json({
        ok: false,
        error: "wa_message_id y estado son requeridos"
      });
    }

    let estadoFinal = 'enviado';

    if (estado === 'sent') estadoFinal = 'enviado';
    if (estado === 'delivered') estadoFinal = 'entregado';
    if (estado === 'read') estadoFinal = 'leido';
    if (estado === 'failed') estadoFinal = 'fallido';

const errorTexto = error
  ? JSON.stringify(error)
  : null;

const [resultado] = await db.query(
  `UPDATE mensajes
   SET estado_mensaje = ?,
       error_envio = ?
   WHERE wa_message_id = ?`,
  [
    estadoFinal,
    estadoFinal === 'fallido' ? errorTexto : null,
    wa_message_id
  ]
);

    console.log("FILAS ACTUALIZADAS:", resultado.affectedRows);

    return res.json({
      ok: true,
      estado_recibido: estado,
      estado_guardado: estadoFinal,
      wa_message_id,
      filas_actualizadas: resultado.affectedRows
    });

  } catch (error) {
    console.error("ERROR ESTADO MENSAJE:", error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
 

function convertirAudioAOggOpus(
  inputPath
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const outputPath =
        inputPath +
        '-voice.ogg';


      ffmpeg(
        inputPath
      )

        .noVideo()

        .audioCodec(
          'libopus'
        )

        .audioChannels(
          1
        )

        .audioFrequency(
          48000
        )

        .audioBitrate(
          '48k'
        )

        .outputOptions([
          '-application voip'
        ])

        .format(
          'ogg'
        )

        .on(
          'end',
          () =>
            resolve(
              outputPath
            )
        )

        .on(
          'error',
          reject
        )

        .save(
          outputPath
        );

    }
  );

}
app.post('/api/enviar-media', requiereLogin, upload.single('archivo'), async (req, res) => {
  try {
    const {
  cliente_id,
  telefono,
  mensaje,
  es_nota_voz
} = req.body;

const esNotaVoz =
  es_nota_voz === '1' ||
  es_nota_voz === 1 ||
  es_nota_voz === true ||
  es_nota_voz === 'true';
    const archivo = req.file;
let archivoPath =
  archivo.path;

let archivoMime =
  archivo.mimetype;

let archivoNombre =
  archivo.originalname;


// =====================================
// SI ES NOTA DE VOZ
// SIEMPRE NORMALIZAMOS A OGG + OPUS
// =====================================

if (
  esNotaVoz
) {

  archivoPath =
    await convertirAudioAOggOpus(
      archivo.path
    );


  archivoMime =
    'audio/ogg';


  archivoNombre =
    `nota_voz_${Date.now()}.ogg`;

}
    if (!cliente_id || !telefono || !archivo) {
      return res.status(400).json({
        ok: false,
        error: 'cliente_id, telefono y archivo son requeridos'
      });
    }
   const [clienteRows] = await db.query(
  `SELECT modo_atencion, asesor_nombre
   FROM clientes
   WHERE id = ?
   LIMIT 1`,
  [cliente_id]
);

if (clienteRows.length === 0) {
  return res.status(404).json({
    ok: false,
    error: 'Cliente no encontrado'
  });
}

const clienteAsignado = clienteRows[0];
const usuarioActual = req.session.usuario;

if (
  clienteAsignado.modo_atencion === 'asesor' &&
  clienteAsignado.asesor_nombre &&
  clienteAsignado.asesor_nombre !== usuarioActual.nombre &&
  usuarioActual.rol !== 'admin'
) {
  return res.status(403).json({
    ok: false,
    bloqueado: true,
    error: `Este chat está siendo atendido por ${clienteAsignado.asesor_nombre}`
  });
}
    let telefonoLimpio = String(telefono || '').replace(/\D/g, '');

    if (telefonoLimpio.length === 9) {
      telefonoLimpio = '51' + telefonoLimpio;
    }

    const mime = archivo.mimetype;
    let tipoMeta = 'document';

    if (mime.startsWith('image/')) tipoMeta = 'image';
    if (mime.startsWith('video/')) tipoMeta = 'video';
    if (mime.startsWith('audio/')) tipoMeta = 'audio';

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
   form.append('file', fs.createReadStream(archivoPath), {
  filename: archivoNombre,
  contentType: archivoMime
});

 const subida = await axios.post(
  `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
  form,
  {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      ...form.getHeaders()
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120000
  }
);

    const mediaId = subida.data.id;

    const payload = {
      messaging_product: 'whatsapp',
      to: telefonoLimpio,
      type: tipoMeta
    };

    if (tipoMeta === 'image') {
      payload.image = { id: mediaId, caption: mensaje || '' };
    }

    if (tipoMeta === 'video') {
      payload.video = { id: mediaId, caption: mensaje || '' };
    }

  if (tipoMeta === 'audio') {

  payload.audio = {
    id: mediaId
  };


  // =====================================
  // NOTA DE VOZ REAL DE WHATSAPP
  // =====================================

  if (esNotaVoz) {

    payload.audio.voice =
      true;

  }

}

    if (tipoMeta === 'document') {
      payload.document = {
        id: mediaId,
        filename: archivo.originalname,
        caption: mensaje || ''
      };
    }
 

   const respuestaMeta = await axios.post(
  `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
  payload,
  {
    headers: {
      Authorization:
        `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type':
        'application/json'
    },

    maxBodyLength:
      Infinity,

    maxContentLength:
      Infinity,

    timeout:
      120000
  }
);


// =======================================
// ID DEL ARCHIVO ENVIADO
// =======================================

const waMessageId =
  respuestaMeta.data.messages?.[0]?.id ||
  null;


// =======================================
// MENSAJE ADICIONAL PARA AUDIO
// =======================================

let waMessageIdTextoAudio =
  null;


if (
  tipoMeta === 'audio' &&
  String(
    mensaje || ''
  ).trim()
) {

  const respuestaTextoAudio =
    await axios.post(
      `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product:
          'whatsapp',

        to:
          telefonoLimpio,

        type:
          'text',

        text: {
          body:
            String(
              mensaje
            ).trim()
        }
      },
      {
        headers: {
          Authorization:
            `Bearer ${process.env.WHATSAPP_TOKEN}`,

          'Content-Type':
            'application/json'
        },

        timeout:
          120000
      }
    );


  waMessageIdTextoAudio =
    respuestaTextoAudio
      .data
      .messages?.[0]?.id ||
    null;

}

const carpetaDestino =
  path.join(
    __dirname,
    'public',
    'uploads',
    'crm'
  );
    if (!fs.existsSync(carpetaDestino)) {
      fs.mkdirSync(carpetaDestino, { recursive: true });
    }
const nombreFinal =
  `${Date.now()}-${archivoNombre.replace(/\s+/g, '_')}`;


const rutaFinal =
  path.join(
    carpetaDestino,
    nombreFinal
  );


// =====================================
// GUARDAMOS EL ARCHIVO REAL
// QUE SE ENVIÓ A META
// =====================================

fs.renameSync(
  archivoPath,
  rutaFinal
);


// =====================================
// SI HUBO CONVERSIÓN,
// BORRAR TEMPORAL ORIGINAL
// =====================================

if (
  archivoPath !==
    archivo.path &&

  fs.existsSync(
    archivo.path
  )
) {

  fs.unlinkSync(
    archivo.path
  );

}

    const mediaUrlLocal = `/uploads/crm/${nombreFinal}`;
const textoGuardado =
  esNotaVoz
    ? '🎙️ Nota de voz'
    : (
        mensaje ||
        archivoNombre
      );

const usuario = req.session.usuario;

await db.query(
`
INSERT INTO mensajes
(
cliente_id,
telefono,
mensaje,
tipo,
usuario_id,
usuario_nombre,
tipo_media,
media_url,
wa_message_id,
nombre_archivo,
mime_type,
estado_mensaje,
pendiente
)
VALUES
(
?,
?,
?,
'saliente',
?,
?,
?,
?,
?,
?,
?,
'enviado',
0
)
`,
[
cliente_id,
telefonoLimpio,
textoGuardado,
usuario.id,
usuario.nombre,
tipoMeta,
mediaUrlLocal,
waMessageId,
archivoNombre,
archivoMime
]);

    await db.query(
      `UPDATE clientes
       SET telefono = ?,
           ultimo_mensaje = ?,
           ultimo_tipo = 'saliente',
           fecha_actualizacion = NOW()
       WHERE id = ?`,
      [telefonoLimpio, textoGuardado, cliente_id]
    );
// =======================================
// AVISAR A N8N POR IMAGEN / AUDIO / VIDEO
// / DOCUMENTO
// =======================================

// =======================================
// EL ASESOR YA RESPONDIÓ CON MULTIMEDIA
// QUITAR ALERTA "SOLICITA ASESOR"
// =======================================

if (
  clienteAsignado.modo_atencion === 'asesor'
) {

  await db.query(
    `
    UPDATE clientes
    SET
      requiere_asesor = 0,
      fecha_solicitud_asesor = NULL,
      fecha_actualizacion = NOW()
    WHERE id = ?
    `,
    [
      cliente_id
    ]
  );


  // =====================================
  // REINICIAR TEMPORIZADOR DE 10 MINUTOS
  // =====================================

  void notificarActividadAsesorN8n({
    clienteId: cliente_id,
    telefono: telefonoLimpio,
    asesorId: usuario.id,
    asesorNombre: usuario.nombre,
    waMessageId
  });

}
    await registrarAuditoria(
  req,
  'ENVIAR_ARCHIVO',
  'mensajes',
  null,
  {
    cliente_id,
    telefono: telefonoLimpio,
    tipo_media: tipoMeta,
    nombre_archivo: archivoNombre,
    media_url: mediaUrlLocal,
    wa_message_id: waMessageId
  }
);
    res.json({
      ok: true,
      tipo_envio: tipoMeta,
      media_url: mediaUrlLocal,
      messageId: waMessageId
    });
   
  } catch (error) {
    console.error('ERROR ENVIAR MEDIA:', error.response?.data || error.message);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      ok: false,
      error: error.response?.data || error.message
    });
  }
});

app.post('/api/usuarios', requiereLogin, upload.single('foto'), async (req, res) => {
  try {
    if (req.session.usuario.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo admin puede crear usuarios' });
    }

    const { nombre, usuario, password, rol } = req.body;

    if (!nombre || !usuario || !password || !rol) {
      return res.status(400).json({ ok: false, error: 'Faltan datos obligatorios' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let fotoUrl = null;

    if (req.file) {
      const carpetaDestino = path.join(__dirname, 'public', 'img', 'usuarios');

      if (!fs.existsSync(carpetaDestino)) {
        fs.mkdirSync(carpetaDestino, { recursive: true });
      }

      const extension = path.extname(req.file.originalname) || '.jpg';
      const nombreFoto = `${Date.now()}-${usuario}${extension}`;
      const rutaFinal = path.join(carpetaDestino, nombreFoto);

      fs.renameSync(req.file.path, rutaFinal);

      fotoUrl = `/img/usuarios/${nombreFoto}`;
    }

    const [resultadoUsuario] = await db.query(
  `INSERT INTO usuarios
   (nombre, usuario, password_hash, rol, activo, foto_url)
   VALUES (?, ?, ?, ?, 1, ?)`,
  [nombre, usuario, passwordHash, rol, fotoUrl]
);

await registrarAuditoria(
  req,
  'CREAR_USUARIO',
  'usuarios',
  resultadoUsuario.insertId,
  {
    nombre,
    usuario,
    rol
  }
);

    res.json({ ok: true });

  } catch (error) {
    console.error('ERROR CREAR USUARIO:', error);

    res.status(500).json({
      ok: false,
      error: error.code === 'ER_DUP_ENTRY'
        ? 'El usuario ya existe'
        : error.message
    });
  }
});
app.put('/api/usuarios/:id', requiereLogin, upload.single('foto'), async (req, res) => {
  try {
    if (req.session.usuario.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo admin puede editar usuarios' });
    }

    const {
  nombre,
  usuario,
  rol,
  activo,
  peso_asignacion,
  recibe_clientes,
  max_conversaciones
} = req.body;
    let fotoUrl = null;

    if (req.file) {
      const carpetaDestino = path.join(__dirname, 'public', 'img', 'usuarios');

      if (!fs.existsSync(carpetaDestino)) {
        fs.mkdirSync(carpetaDestino, { recursive: true });
      }

      const extension = path.extname(req.file.originalname) || '.jpg';
      const nombreFoto = `${Date.now()}-${usuario}${extension}`;
      const rutaFinal = path.join(carpetaDestino, nombreFoto);

      fs.renameSync(req.file.path, rutaFinal);
      fotoUrl = `/img/usuarios/${nombreFoto}`;
    }

    if (fotoUrl) {
    await db.query(
  `
  UPDATE usuarios
  SET
    nombre = ?,
    usuario = ?,
    rol = ?,
    activo = ?,
    foto_url = ?,
    peso_asignacion = ?,
    recibe_clientes = ?,
    max_conversaciones = ?
  WHERE id = ?
  `,
  [
    nombre,
    usuario,
    rol,
    Number(activo),
    fotoUrl,
    Math.max(Number(peso_asignacion) || 1, 1),
    Number(recibe_clientes) ? 1 : 0,
    max_conversaciones
      ? Number(max_conversaciones)
      : null,
    req.params.id
  ]
);
    } else {
  await db.query(
  `
  UPDATE usuarios
  SET
    nombre = ?,
    usuario = ?,
    rol = ?,
    activo = ?,
    peso_asignacion = ?,
    recibe_clientes = ?,
    max_conversaciones = ?
  WHERE id = ?
  `,
  [
    nombre,
    usuario,
    rol,
    Number(activo),
    Math.max(Number(peso_asignacion) || 1, 1),
    Number(recibe_clientes) ? 1 : 0,
    max_conversaciones
      ? Number(max_conversaciones)
      : null,
    req.params.id
  ]
);
    }
await registrarAuditoria(
  req,
  'EDITAR_USUARIO',
  'usuarios',
  req.params.id,
  {
    nombre,
    usuario,
    rol,
    activo,
    cambio_foto: Boolean(req.file)
  }
);
    res.json({ ok: true });

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.code === 'ER_DUP_ENTRY' ? 'El usuario ya existe' : error.message
    });
  }
});

app.patch('/api/usuarios/:id/password', requiereLogin, async (req, res) => {
  try {
    if (req.session.usuario.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo admin puede cambiar contraseñas' });
    }

    const { password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ ok: false, error: 'Contraseña muy corta' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `UPDATE usuarios SET password_hash = ? WHERE id = ?`,
      [passwordHash, req.params.id]
    );
    await registrarAuditoria(
  req,
  'CAMBIAR_PASSWORD',
  'usuarios',
  req.params.id,
  {
    password_actualizado: true
  }
);
    res.json({ ok: true });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete('/api/usuarios/:id', requiereLogin, async (req, res) => {
  try {
    if (req.session.usuario.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo admin puede eliminar usuarios' });
    }

    if (Number(req.params.id) === Number(req.session.usuario.id)) {
      return res.status(400).json({ ok: false, error: 'No puedes eliminar tu propio usuario' });
    }

    await db.query(
      `UPDATE usuarios SET activo = 0 WHERE id = ?`,
      [req.params.id]
    );
   await registrarAuditoria(
  req,
  'DESACTIVAR_USUARIO',
  'usuarios',
  req.params.id,
  {
    activo: 0
  }
);
    res.json({ ok: true });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get('/api/usuarios', requiereLogin, async (req, res) => {
  try {
    if (req.session.usuario.rol !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo admin puede ver usuarios' });
    }

const [usuarios] = await db.query(`
  SELECT
    id,
    nombre,
    usuario,
    rol,
    activo,
    fecha_creacion,
    foto_url,
    peso_asignacion,
    recibe_clientes,
    max_conversaciones
  FROM usuarios
  ORDER BY id DESC
`);

    res.json(usuarios);

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get('/api/respuestas-rapidas', requiereLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `  SELECT
            id,
            titulo,
               atajo,
            texto,
            imagen_url 
       FROM respuestas_rapidas 
       WHERE activo = 1 
       ORDER BY id ASC`
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post(
  '/api/respuestas-rapidas',
  requiereLogin,
  async (req, res) => {
    try {

      let {
        titulo,
        atajo,
        texto
      } = req.body;


      titulo =
        String(
          titulo || ''
        ).trim();


      texto =
        String(
          texto || ''
        ).trim();


      atajo =
        String(
          atajo || ''
        )
          .trim()
          .toLowerCase();


      if (
        atajo &&
        !atajo.startsWith('/')
      ) {
        atajo =
          '/' + atajo;
      }


      if (
        !titulo ||
        !texto
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Título y mensaje son obligatorios.'
        });

      }


      if (atajo) {

        const [existe] =
          await db.query(
            `
            SELECT id

            FROM respuestas_rapidas

            WHERE LOWER(atajo) = ?
              AND activo = 1

            LIMIT 1
            `,
            [
              atajo
            ]
          );


        if (existe.length) {

          return res.status(409).json({
            ok: false,
            error:
              `El atajo ${atajo} ya está siendo utilizado.`
          });

        }

      }


      await db.query(
        `
        INSERT INTO respuestas_rapidas
        (
          titulo,
          atajo,
          texto
        )
        VALUES (?, ?, ?)
        `,
        [
          titulo,
          atajo || null,
          texto
        ]
      );


      res.json({
        ok: true
      });


    } catch (error) {

      res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }
  }
);

app.put(
  '/api/respuestas-rapidas/:id',
  requiereLogin,
  async (req, res) => {
    try {

      const respuestaId =
        Number(
          req.params.id
        );


      let {
        titulo,
        atajo,
        texto
      } = req.body;


      titulo =
        String(
          titulo || ''
        ).trim();


      texto =
        String(
          texto || ''
        ).trim();


      atajo =
        String(
          atajo || ''
        )
          .trim()
          .toLowerCase();


      if (
        atajo &&
        !atajo.startsWith('/')
      ) {
        atajo =
          '/' + atajo;
      }


      if (
        !titulo ||
        !texto
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'Título y mensaje son obligatorios.'
        });

      }


      if (atajo) {

        const [existe] =
          await db.query(
            `
            SELECT id

            FROM respuestas_rapidas

            WHERE LOWER(atajo) = ?
              AND id <> ?
              AND activo = 1

            LIMIT 1
            `,
            [
              atajo,
              respuestaId
            ]
          );


        if (existe.length) {

          return res.status(409).json({
            ok: false,
            error:
              `El atajo ${atajo} ya está siendo utilizado.`
          });

        }

      }


      await db.query(
        `
        UPDATE respuestas_rapidas

        SET
          titulo = ?,
          atajo = ?,
          texto = ?

        WHERE id = ?
        `,
        [
          titulo,
          atajo || null,
          texto,
          respuestaId
        ]
      );


      res.json({
        ok: true
      });


    } catch (error) {

      res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }
  }
);

// =======================================
// IMAGEN DE RESPUESTA RÁPIDA
// =======================================

app.post(
  '/api/respuestas-rapidas/:id/imagen',
  requiereLogin,
  upload.single('imagen'),
  async (req, res) => {
    try {

      const respuestaId =
        Number(req.params.id);

      const archivo =
        req.file;


      if (!respuestaId) {

        return res.status(400).json({
          ok: false,
          error:
            'Respuesta rápida inválida.'
        });

      }


      if (!archivo) {

        return res.status(400).json({
          ok: false,
          error:
            'Selecciona una imagen.'
        });

      }


      if (
        !String(
          archivo.mimetype || ''
        ).startsWith('image/')
      ) {

        if (
          archivo.path &&
          fs.existsSync(archivo.path)
        ) {
          fs.unlinkSync(
            archivo.path
          );
        }


        return res.status(400).json({
          ok: false,
          error:
            'El archivo debe ser una imagen.'
        });

      }


      // Máximo recomendado: 8 MB
      if (
        Number(archivo.size || 0) >
        8 * 1024 * 1024
      ) {

        if (
          archivo.path &&
          fs.existsSync(archivo.path)
        ) {
          fs.unlinkSync(
            archivo.path
          );
        }


        return res.status(400).json({
          ok: false,
          error:
            'La imagen no debe superar 8 MB.'
        });

      }


      const [actuales] =
        await db.query(
          `
          SELECT imagen_url

          FROM respuestas_rapidas

          WHERE id = ?

          LIMIT 1
          `,
          [
            respuestaId
          ]
        );


      if (!actuales.length) {

        if (
          archivo.path &&
          fs.existsSync(archivo.path)
        ) {
          fs.unlinkSync(
            archivo.path
          );
        }


        return res.status(404).json({
          ok: false,
          error:
            'Respuesta rápida no encontrada.'
        });

      }


      const carpeta =
        path.join(
          __dirname,
          'public',
          'uploads',
          'respuestas-rapidas'
        );


      if (
        !fs.existsSync(carpeta)
      ) {

        fs.mkdirSync(
          carpeta,
          {
            recursive: true
          }
        );

      }


      let extension =
        path.extname(
          archivo.originalname || ''
        ).toLowerCase();


      if (!extension) {

        if (
          archivo.mimetype ===
          'image/png'
        ) {
          extension = '.png';

        } else if (
          archivo.mimetype ===
          'image/webp'
        ) {
          extension = '.webp';

        } else {

          extension = '.jpg';

        }

      }


      const nombreArchivo =
        `rapida-${respuestaId}-${Date.now()}${extension}`;


      const rutaDestino =
        path.join(
          carpeta,
          nombreArchivo
        );


      fs.renameSync(
        archivo.path,
        rutaDestino
      );


      const imagenUrl =
        `/uploads/respuestas-rapidas/${nombreArchivo}`;


      // Borrar imagen antigua
      const imagenAnterior =
        String(
          actuales[0].imagen_url ||
          ''
        ).trim();


      if (
        imagenAnterior.startsWith(
          '/uploads/respuestas-rapidas/'
        )
      ) {

        const rutaAnterior =
          path.join(
            __dirname,
            'public',
            imagenAnterior
              .replace(
                /^\/+/,
                ''
              )
          );


        if (
          fs.existsSync(
            rutaAnterior
          )
        ) {

          try {
            fs.unlinkSync(
              rutaAnterior
            );
          } catch (error) {
            console.warn(
              'No se pudo borrar imagen anterior:',
              error.message
            );
          }

        }

      }


      await db.query(
        `
        UPDATE respuestas_rapidas

        SET imagen_url = ?

        WHERE id = ?
        `,
        [
          imagenUrl,
          respuestaId
        ]
      );


      return res.json({
        ok: true,
        imagen_url:
          imagenUrl
      });


    } catch (error) {

      console.error(
        'ERROR IMAGEN RESPUESTA RÁPIDA:',
        error
      );


      if (
        req.file?.path &&
        fs.existsSync(
          req.file.path
        )
      ) {

        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}

      }


      return res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }
  }
);


// =======================================
// ELIMINAR IMAGEN RESPUESTA RÁPIDA
// =======================================

app.delete(
  '/api/respuestas-rapidas/:id/imagen',
  requiereLogin,
  async (req, res) => {
    try {

      const respuestaId =
        Number(req.params.id);


      const [rows] =
        await db.query(
          `
          SELECT imagen_url

          FROM respuestas_rapidas

          WHERE id = ?

          LIMIT 1
          `,
          [
            respuestaId
          ]
        );


      if (!rows.length) {

        return res.status(404).json({
          ok: false,
          error:
            'Respuesta rápida no encontrada.'
        });

      }


      const imagenUrl =
        String(
          rows[0].imagen_url ||
          ''
        ).trim();


      if (
        imagenUrl.startsWith(
          '/uploads/respuestas-rapidas/'
        )
      ) {

        const ruta =
          path.join(
            __dirname,
            'public',
            imagenUrl.replace(
              /^\/+/,
              ''
            )
          );


        if (
          fs.existsSync(ruta)
        ) {

          try {
            fs.unlinkSync(ruta);
          } catch (error) {

            console.warn(
              'No se pudo borrar la imagen:',
              error.message
            );

          }

        }

      }


      await db.query(
        `
        UPDATE respuestas_rapidas

        SET imagen_url = NULL

        WHERE id = ?
        `,
        [
          respuestaId
        ]
      );


      return res.json({
        ok: true
      });


    } catch (error) {

      console.error(
        'ERROR ELIMINANDO IMAGEN:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }
  }
);


app.delete('/api/respuestas-rapidas/:id', requiereLogin, async (req, res) => {
  try {
    await db.query(
      `UPDATE respuestas_rapidas SET activo = 0 WHERE id = ?`,
      [req.params.id]
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/auditoria', requiereLogin, async (req, res) => {
  try {
    if (req.session.usuario.rol !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: 'Solo el administrador puede ver auditoría'
      });
    }

    const limite = Math.min(
      Number(req.query.limite || 100),
      500
    );

    const [registros] = await db.query(
      `SELECT
         id,
         usuario_id,
         usuario_nombre,
         accion,
         entidad,
         entidad_id,
         detalle,
         ip,
         fecha
       FROM auditoria
       ORDER BY fecha DESC, id DESC
       LIMIT ?`,
      [limite]
    );

    res.json(registros);

  } catch (error) {
    console.error('ERROR LISTAR AUDITORÍA:', error);

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post(
  '/api/mensajes/:id/reintentar',
  requiereLogin,
  async (req, res) => {
    try {
      const mensajeId = Number(req.params.id);

      if (!mensajeId) {
        return res.status(400).json({
          ok: false,
          error: 'ID de mensaje inválido'
        });
      }

      const [rows] = await db.query(
        `SELECT
           m.*,
           c.modo_atencion,
           c.asesor_nombre
         FROM mensajes m
         INNER JOIN clientes c
           ON c.id = m.cliente_id
         WHERE m.id = ?
         LIMIT 1`,
        [mensajeId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          ok: false,
          error: 'Mensaje no encontrado'
        });
      }

      const registro = rows[0];
      const usuarioActual = req.session.usuario;

      if (registro.tipo !== 'saliente') {
        return res.status(400).json({
          ok: false,
          error: 'Solo se pueden reenviar mensajes salientes'
        });
      }

      if (registro.estado_mensaje !== 'fallido') {
        return res.status(400).json({
          ok: false,
          error: 'Este mensaje no está marcado como fallido'
        });
      }

      const perteneceAOtroAsesor =
        registro.modo_atencion === 'asesor' &&
        registro.asesor_nombre &&
        registro.asesor_nombre !== usuarioActual.nombre &&
        usuarioActual.rol !== 'admin';

      if (perteneceAOtroAsesor) {
        return res.status(403).json({
          ok: false,
          bloqueado: true,
          error:
            `Este chat está siendo atendido por ${registro.asesor_nombre}`
        });
      }

      let telefonoLimpio = String(registro.telefono || '')
        .replace(/\D/g, '');

      if (telefonoLimpio.length === 9) {
        telefonoLimpio = `51${telefonoLimpio}`;
      }

      if (!/^51\d{9}$/.test(telefonoLimpio)) {
        return res.status(400).json({
          ok: false,
          error: 'El teléfono guardado no es válido'
        });
      }

      let respuestaMeta;

      // =========================
      // REINTENTO DE TEXTO
      // =========================

      if (
        !registro.tipo_media ||
        registro.tipo_media === 'text'
      ) {
        respuestaMeta = await axios.post(
          `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: 'whatsapp',
            to: telefonoLimpio,
            type: 'text',
            text: {
              body: registro.mensaje
            }
          },
          {
            headers: {
              Authorization:
                `Bearer ${process.env.WHATSAPP_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 120000
          }
        );
      } else {
        // =========================
        // REINTENTO DE MULTIMEDIA
        // =========================

        if (!registro.media_url) {
          return res.status(400).json({
            ok: false,
            error: 'El mensaje no tiene un archivo guardado'
          });
        }

        const rutaRelativa = registro.media_url
          .replace(/^\/+/, '');

        const rutaArchivo = path.join(
          __dirname,
          'public',
          rutaRelativa.replace(/^uploads\//, 'uploads/')
        );

        const nombreArchivo =
          registro.nombre_archivo ||
          path.basename(rutaArchivo);

        const mimeType =
          registro.mime_type ||
          'application/octet-stream';

        const mediaId = await subirArchivoAMeta({
          rutaArchivo,
          nombreArchivo,
          mimeType
        });

        const payload = {
          messaging_product: 'whatsapp',
          to: telefonoLimpio,
          type: registro.tipo_media
        };

        if (registro.tipo_media === 'image') {
          payload.image = {
            id: mediaId,
            caption: registro.caption || registro.mensaje || ''
          };
        }

        if (registro.tipo_media === 'video') {
          payload.video = {
            id: mediaId,
            caption: registro.caption || registro.mensaje || ''
          };
        }

        if (registro.tipo_media === 'audio') {
          payload.audio = {
            id: mediaId
          };
        }

        if (registro.tipo_media === 'document') {
          payload.document = {
            id: mediaId,
            filename: nombreArchivo,
            caption: registro.caption || registro.mensaje || ''
          };
        }

        respuestaMeta = await axios.post(
          `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          payload,
          {
            headers: {
              Authorization:
                `Bearer ${process.env.WHATSAPP_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 120000
          }
        );
      }

      const nuevoWaMessageId =
        respuestaMeta.data.messages?.[0]?.id || null;

      await db.query(
        `UPDATE mensajes
         SET wa_message_id = ?,
             estado_mensaje = 'enviado',
             intentos_reenvio = intentos_reenvio + 1,
             fecha_ultimo_reintento = NOW(),
             error_envio = NULL,
             usuario_id = ?,
             usuario_nombre = ?
         WHERE id = ?`,
        [
          nuevoWaMessageId,
          usuarioActual.id,
          usuarioActual.nombre,
          mensajeId
        ]
      );

      await db.query(
        `UPDATE clientes
         SET ultimo_mensaje = ?,
             ultimo_tipo = 'saliente',
             fecha_actualizacion = NOW()
         WHERE id = ?`,
        [
          registro.mensaje,
          registro.cliente_id
        ]
      );

      await registrarAuditoria(
        req,
        'REINTENTAR_MENSAJE',
        'mensajes',
        mensajeId,
        {
          cliente_id: registro.cliente_id,
          tipo_media: registro.tipo_media || 'text',
          nuevo_wa_message_id: nuevoWaMessageId,
          intento:
            Number(registro.intentos_reenvio || 0) + 1
        }
      );

      return res.json({
        ok: true,
        messageId: nuevoWaMessageId,
        estado: 'enviado'
      });

    } catch (error) {
      console.error(
        'ERROR REINTENTAR MENSAJE:',
        error.response?.data || error.message
      );

      const mensajeId = Number(req.params.id);

      if (mensajeId) {
        await db.query(
          `UPDATE mensajes
           SET intentos_reenvio = intentos_reenvio + 1,
               fecha_ultimo_reintento = NOW(),
               estado_mensaje = 'fallido',
               error_envio = ?
           WHERE id = ?`,
          [
            JSON.stringify(
              error.response?.data || {
                message: error.message
              }
            ),
            mensajeId
          ]
        );
      }

      return res.status(500).json({
        ok: false,
        error:
          error.response?.data?.error?.message ||
          error.response?.data ||
          error.message
      });
    }
  }
);
function requiereApiN8n(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado'
    });
  }

  next();
}
// =======================================
// HISTORIAL CORTO PARA RETORNO IA
// SOLO SE CONSULTA CUANDO N8N NECESITA IA
// =======================================

app.get(
  '/api/n8n/clientes/historial/:telefono',
  requiereApiN8n,
  async (req, res) => {
    try {

      // ==========================================
      // 1. NORMALIZAR TELÉFONO
      // ==========================================

      let telefono = String(
        req.params.telefono || ''
      ).replace(/\D/g, '');


      // Si llega como:
      // 987654321
      //
      // convertir a:
      // 51987654321

      if (telefono.length === 9) {
        telefono =
          '51' + telefono;
      }


      // ==========================================
      // 2. VALIDAR TELÉFONO
      // ==========================================

      if (!telefono) {

        return res.status(400).json({
          ok: false,
          error:
            'Telefono requerido'
        });

      }


      // ==========================================
      // 3. BUSCAR CLIENTE Y SU ESTADO ACTUAL
      // ==========================================

      const [clientes] =
        await db.query(
          `
          SELECT
            id,
            nombre,
            telefono,

            estado_conversacion,

            ultimo_producto_nombre,
            ultimo_producto_sku,

            tipo_entrega,
            medio_pago,
            estado_pago

          FROM clientes

          WHERE telefono = ?

          LIMIT 1
          `,
          [
            telefono
          ]
        );


      // ==========================================
      // 4. SI EL CLIENTE NO EXISTE
      // ==========================================

      if (!clientes.length) {

        return res.json({
          ok: true,
          encontrado: false,
          historial: []
        });

      }


      const cliente =
        clientes[0];


      // ==========================================
      // 5. OBTENER SOLO LOS ÚLTIMOS 6 MENSAJES
      // ==========================================

      const [historial] =
        await db.query(
          `
          SELECT
            tipo,
            mensaje,
            tipo_media,
            fecha

          FROM (

            SELECT
              tipo,
              mensaje,
              tipo_media,
              fecha

            FROM mensajes

            WHERE cliente_id = ?

            ORDER BY
              fecha DESC

            LIMIT 6

          ) ultimos

          ORDER BY
            fecha ASC
          `,
          [
            cliente.id
          ]
        );


      // ==========================================
      // 6. RESPONDER A N8N
      // ==========================================

      return res.json({
        ok: true,

        encontrado: true,

        cliente: {

          id:
            cliente.id,

          nombre:
            cliente.nombre,

          telefono:
            cliente.telefono,

          estado_conversacion:
            cliente.estado_conversacion,

          ultimo_producto_nombre:
            cliente.ultimo_producto_nombre,

          ultimo_producto_sku:
            cliente.ultimo_producto_sku,

          tipo_entrega:
            cliente.tipo_entrega,

          medio_pago:
            cliente.medio_pago,

          estado_pago:
            cliente.estado_pago
        },

        historial
      });


    } catch (error) {

      console.error(
        'ERROR HISTORIAL CORTO N8N:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          error.message
      });

    }
  }
);
// =======================================
// GUARDAR DATOS PERSONALES Y DE ENTREGA
// DESDE N8N
// =======================================

app.post(
  '/api/n8n/clientes/datos',
  requiereApiN8n,
  async (req, res) => {
    try {
      let telefono = String(
        req.body.telefono || ''
      ).replace(/\D/g, '');

      if (telefono.length === 9) {
        telefono = `51${telefono}`;
      }

      const nombre = String(
        req.body.nombre || ''
      ).trim();

      const documentoTipo = String(
        req.body.documento_tipo || ''
      )
        .trim()
        .toUpperCase();

      const documentoNumero = String(
        req.body.documento_numero || ''
      )
        .replace(/\D/g, '')
        .trim();

      const direccion = String(
        req.body.direccion || ''
      ).trim();

      const referencia = String(
        req.body.referencia || ''
      ).trim();

      const distrito = String(
        req.body.distrito || ''
      ).trim();

      const ciudad = String(
        req.body.ciudad || ''
      ).trim();

      const departamento = String(
        req.body.departamento || ''
      ).trim();

      const agencia = String(
        req.body.agencia || ''
      ).trim();

      const tipoEntrega = String(
        req.body.tipo_entrega || ''
      )
        .trim()
        .toLowerCase();

      if (!telefono) {
        return res.status(400).json({
          ok: false,
          error: 'El teléfono es obligatorio'
        });
      }

      if (!/^51\d{9}$/.test(telefono)) {
        return res.status(400).json({
          ok: false,
          error:
            'El teléfono debe tener el formato 519XXXXXXXX'
        });
      }

      if (
        documentoTipo &&
        !['DNI', 'RUC', 'CE', 'OTRO'].includes(
          documentoTipo
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'El tipo de documento no es válido'
        });
      }

      if (
        documentoTipo === 'DNI' &&
        documentoNumero &&
        documentoNumero.length !== 8
      ) {
        return res.status(400).json({
          ok: false,
          error: 'El DNI debe tener 8 dígitos'
        });
      }

      if (
        documentoTipo === 'RUC' &&
        documentoNumero &&
        documentoNumero.length !== 11
      ) {
        return res.status(400).json({
          ok: false,
          error: 'El RUC debe tener 11 dígitos'
        });
      }

      const [clientes] = await db.query(
        `
        SELECT
          id,
          nombre,
          telefono
        FROM clientes
        WHERE telefono = ?
        LIMIT 1
        `,
        [telefono]
      );

      if (!clientes.length) {
        return res.status(404).json({
          ok: false,
          error:
            'No se encontró un cliente con ese teléfono'
        });
      }

      const cliente = clientes[0];

      const datosEntrega = {
        nombre: nombre || null,
        documento_tipo:
          documentoTipo || null,
        documento_numero:
          documentoNumero || null,
        direccion: direccion || null,
        referencia: referencia || null,
        distrito: distrito || null,
        ciudad: ciudad || null,
        departamento:
          departamento || null,
        agencia: agencia || null,
        tipo_entrega:
          tipoEntrega || null,
        actualizado_en:
          new Date().toISOString()
      };

      await db.query(
        `
        UPDATE clientes
        SET
          nombre = CASE
            WHEN ? <> '' THEN ?
            ELSE nombre
          END,

          documento_tipo = CASE
            WHEN ? <> '' THEN ?
            ELSE documento_tipo
          END,

          documento_numero = CASE
            WHEN ? <> '' THEN ?
            ELSE documento_numero
          END,

          direccion = CASE
            WHEN ? <> '' THEN ?
            ELSE direccion
          END,

          referencia = CASE
            WHEN ? <> '' THEN ?
            ELSE referencia
          END,

          distrito = CASE
            WHEN ? <> '' THEN ?
            ELSE distrito
          END,

          ciudad = CASE
            WHEN ? <> '' THEN ?
            ELSE ciudad
          END,

          departamento = CASE
            WHEN ? <> '' THEN ?
            ELSE departamento
          END,

          agencia = CASE
            WHEN ? <> '' THEN ?
            ELSE agencia
          END,

          tipo_entrega = CASE
            WHEN ? <> '' THEN ?
            ELSE tipo_entrega
          END,

          datos_entrega = ?,
          fecha_actualizacion = NOW()

        WHERE id = ?
        `,
        [
          nombre,
          nombre,

          documentoTipo,
          documentoTipo,

          documentoNumero,
          documentoNumero,

          direccion,
          direccion,

          referencia,
          referencia,

          distrito,
          distrito,

          ciudad,
          ciudad,

          departamento,
          departamento,

          agencia,
          agencia,

          tipoEntrega,
          tipoEntrega,

          JSON.stringify(datosEntrega),
          cliente.id
        ]
      );

      return res.json({
        ok: true,
        cliente_id: cliente.id,
        telefono,
        datos_guardados: datosEntrega
      });

    } catch (error) {
      console.error(
        'ERROR GUARDANDO DATOS DEL CLIENTE:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          'No se pudieron guardar los datos del cliente',
        detalle: error.message
      });
    }
  }
);

app.post(
  '/api/n8n/clientes/modo-atencion',
  requiereApiN8n,
  async (req, res) => {

    try {

      let telefono = String(
        req.body.telefono || ''
      ).replace(/\D/g, '');


      const modoAtencion = String(
        req.body.modo_atencion || ''
      )
        .trim()
        .toLowerCase();


      // ==========================================
      // ¿EL CLIENTE ESTÁ SOLICITANDO UN ASESOR?
      // ==========================================

      const requiereAsesor =
        req.body.requiere_asesor === true ||
        req.body.requiere_asesor === 1 ||
        String(
          req.body.requiere_asesor || ''
        ).toLowerCase() === 'true';


      const asesorNombreRecibido = String(
        req.body.asesor_nombre || ''
      ).trim();


      if (telefono.length === 9) {
        telefono = `51${telefono}`;
      }


      if (!telefono || !modoAtencion) {

        return res.status(400).json({
          ok: false,
          error:
            'telefono y modo_atencion son requeridos'
        });

      }


      if (
        ![
          'bot',
          'asesor'
        ].includes(modoAtencion)
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'modo_atencion inválido'
        });

      }


      // ==========================================
      // OBTENER CLIENTE ACTUAL
      // IMPORTANTE: CONSERVAMOS SU ASESOR ASIGNADO
      // ==========================================

      const [clientes] =
        await db.query(
          `
          SELECT
            id,
            telefono,
            modo_atencion,
            asesor_id,
            asesor_nombre,
            requiere_asesor,
            fecha_solicitud_asesor
          FROM clientes
          WHERE telefono = ?
          LIMIT 1
          `,
          [telefono]
        );


      if (!clientes.length) {

        return res.status(404).json({
          ok: false,
          error:
            'No se encontró un cliente con ese teléfono'
        });

      }


      const clienteActual =
        clientes[0];


      // ==========================================
      // CONSERVAR ASESOR
      // ==========================================

      let asesorNombreFinal =
        clienteActual.asesor_nombre ||
        null;


      // Solo reemplazamos el nombre si realmente
      // n8n recibió un asesor específico.
      if (
        asesorNombreRecibido &&
        asesorNombreRecibido.toLowerCase() !==
          'asesor'
      ) {

        asesorNombreFinal =
          asesorNombreRecibido;

      }


      // ==========================================
      // ESTADO DE SOLICITUD
      // ==========================================
      //
      // Ejemplo:
      //
      // modo_atencion = asesor
      // requiere_asesor = 1
      //
      // → 🔴 Solicita asesor
      //
      // Cuando vuelve al bot:
      //
      // requiere_asesor = 0
      //
      // pero CONSERVA asesor_nombre.
      // ==========================================

      const requiereAsesorFinal =
        modoAtencion === 'asesor' &&
        requiereAsesor;


      const [resultado] =
        await db.query(
          `
          UPDATE clientes
          SET
            modo_atencion = ?,

            asesor_nombre = ?,

            requiere_asesor = ?,

            fecha_solicitud_asesor =
              CASE
                WHEN ? = 1
                  THEN COALESCE(
                    fecha_solicitud_asesor,
                    NOW()
                  )
                ELSE NULL
              END,

            fecha_actualizacion = NOW()

          WHERE id = ?
          `,
          [
            modoAtencion,

            asesorNombreFinal,

            requiereAsesorFinal
              ? 1
              : 0,

            requiereAsesorFinal
              ? 1
              : 0,

            clienteActual.id
          ]
        );


      if (
        resultado.affectedRows === 0
      ) {

        return res.status(404).json({
          ok: false,
          error:
            'No se pudo actualizar el cliente'
        });

      }


      // ==========================================
      // INICIAR TEMPORIZADOR DE 10 MINUTOS
      // SI PASA A ATENCIÓN HUMANA
      // ==========================================

      if (
        modoAtencion === 'asesor' &&
        typeof notificarActividadAsesorN8n ===
          'function'
      ) {

        void notificarActividadAsesorN8n({

          clienteId:
            clienteActual.id,

          telefono:
            telefono,

          asesorId:
            clienteActual.asesor_id,

          asesorNombre:
            asesorNombreFinal,

          waMessageId:
            null

        });

      }


      return res.json({

        ok: true,

        telefono,

        modo_atencion:
          modoAtencion,

        asesor_id:
          clienteActual.asesor_id ||
          null,

        asesor_nombre:
          asesorNombreFinal,

        requiere_asesor:
          requiereAsesorFinal,

        fecha_solicitud_asesor:
          requiereAsesorFinal
            ? new Date().toISOString()
            : null

      });


    } catch (error) {

      console.error(
        'ERROR MODO ATENCIÓN N8N:',
        error
      );


      return res.status(500).json({
        ok: false,
        error:
          'No se pudo actualizar el modo de atención'
      });

    }

  }
);
app.post(
  '/api/n8n/clientes/estado-conversacion',
  requiereApiN8n,
  async (req, res) => {
    try {
      const telefono = String(
        req.body.telefono || ''
      ).replace(/\D/g, '');

      const estadoConversacion =
        req.body.estado_conversacion || null;

      
      const sku = req.body.sku || null;

const producto = req.body.producto || null;

const precio = req.body.precio || null;

const cantidad = req.body.cantidad || null;

      if (!telefono) {
        return res.status(400).json({
          ok: false,
          error: 'El teléfono es obligatorio'
        });
      }

const [resultado] = await db.query(
  `
UPDATE clientes
SET
estado_conversacion=?,
producto_pendiente=?,
cantidad_pendiente=?,
ultimo_producto_sku=?,
ultimo_producto_nombre=?,
ultimo_producto_precio=?,
fecha_actualizacion=NOW()
WHERE telefono=?
  `,
[
estadoConversacion,
producto,
cantidad,
sku,
producto,
precio,
telefono
]
);

      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          ok: false,
          error: 'Cliente no encontrado'
        });
      }

      return res.json({
        ok: true,
        telefono,
        estado_conversacion: estadoConversacion
      });

    } catch (error) {
      console.error(
        'ERROR GUARDANDO ESTADO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: 'No se pudo guardar el estado'
      });
    }
  }
);
app.get(
  '/api/n8n/clientes/contexto/:telefono',
  requiereApiN8n,
  async (req, res) => {
    try {
      let telefono = String(
        req.params.telefono || ''
      ).replace(/\D/g, '');

      // Si llega sin código de país (Perú)
      if (telefono.length === 9) {
        telefono = '51' + telefono;
      }

      const [rows] = await db.query(
        `
    SELECT
  id,
  nombre,
  telefono,
  estado_conversacion,
  producto_pendiente,
  cantidad_pendiente,
  ultimo_producto_nombre,
  ultimo_producto_sku,
  ultimo_producto_precio,

  tipo_entrega,
  datos_entrega,
documento_tipo,
documento_numero,

correo,
tipo_comprobante,

direccion,
referencia,
  distrito,
  ciudad,
  departamento,
  agencia,

medio_pago,
estado_pago,
total_pedido,
comprobante_url,

modo_atencion,

ultima_interaccion_cliente,

UNIX_TIMESTAMP(
  ultima_interaccion_cliente
) * 1000 AS ultima_interaccion_cliente_ms,

fecha_actualizacion

FROM clientes
        WHERE telefono = ?
        LIMIT 1
        `,
        [telefono]
      );

      if (!rows.length) {
        return res.json({
          ok: true,
          encontrado: false,
          contexto: null
        });
      }

      return res.json({
        ok: true,
        encontrado: true,
        contexto: rows[0]
      });

    } catch (error) {
      console.error(
        'ERROR CONSULTANDO CONTEXTO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: 'No se pudo consultar el contexto'
      });
    }
  }
);
app.post('/api/chatbot/contexto', async (req, res) => {
    try {

        let {
            telefono,
            ultimo_producto,
            ultima_intencion,
            cantidad = 1,
            sku = null,
            precio = null
        } = req.body;

        telefono = String(telefono || '').replace(/\D/g, '');

        if (telefono.length === 9) {
            telefono = '51' + telefono;
        }

        await db.query(`
            UPDATE clientes
            SET
                estado_conversacion = ?,
                producto_pendiente = ?,
                cantidad_pendiente = ?,
                ultimo_producto_nombre = ?,
                ultimo_producto_sku = ?,
                ultimo_producto_precio = ?,
                fecha_actualizacion = NOW()
            WHERE telefono = ?
        `,[
            ultima_intencion,
            ultimo_producto,
            cantidad,
            ultimo_producto,
            sku,
            precio,
            telefono
        ]);

        res.json({
            ok:true
        });

    } catch(err){

        res.status(500).json({
            ok:false,
            error:err.message
        });

    }
});

app.post(
  '/api/n8n/clientes/contexto',
  requiereApiN8n,
  async (req, res) => {
    try {

      let telefono = String(
        req.body.telefono || ''
      ).replace(/\D/g, '');

      if (telefono.length === 9) {
        telefono = '51' + telefono;
      }

      if (!telefono) {
        return res.status(400).json({
          ok: false,
          error: 'El teléfono es obligatorio'
        });
      }

      if (
  Object.prototype.hasOwnProperty.call(
    req.body,
    'correo'
  )
) {

  const correo =
    String(
      req.body.correo || ''
    )
      .trim()
      .toLowerCase();


  const correoValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(correo);


  if (
    correo &&
    !correoValido
  ) {

    return res.status(400).json({
      ok: false,
      error:
        'Correo electrónico inválido'
    });

  }


  req.body.correo =
    correo || null;

}
      // Solo actualizamos los datos que realmente
      // hayan sido enviados desde n8n.
      //
      // Así evitamos borrar información anterior
      // accidentalmente.

    const camposPermitidos = {

  estado_conversacion:
    'estado_conversacion',

  producto_pendiente:
    'producto_pendiente',

  cantidad_pendiente:
    'cantidad_pendiente',

  ultimo_producto_nombre:
    'ultimo_producto_nombre',

  ultimo_producto_sku:
    'ultimo_producto_sku',

  ultimo_producto_precio:
    'ultimo_producto_precio',

  tipo_entrega:
    'tipo_entrega',

  datos_entrega:
    'datos_entrega',

  // ==============================
  // DATOS DE FACTURACIÓN
  // ==============================

  correo:
    'correo',

  tipo_comprobante:
    'tipo_comprobante',

  medio_pago:
    'medio_pago',

  estado_pago:
    'estado_pago',

  total_pedido:
    'total_pedido',

  comprobante_url:
    'comprobante_url'
};


      const asignaciones = [];
      const valores = [];


      for (
        const [entrada, columna]
        of Object.entries(camposPermitidos)
      ) {

        if (
          Object.prototype.hasOwnProperty.call(
            req.body,
            entrada
          )
        ) {

          asignaciones.push(
            `${columna} = ?`
          );

          valores.push(
            req.body[entrada]
          );

        }

      }


      if (!asignaciones.length) {

        return res.json({
          ok: true,
          actualizados: 0,
          mensaje:
            'No se enviaron campos de contexto para actualizar'
        });

      }


      asignaciones.push(
        'fecha_actualizacion = NOW()'
      );

      valores.push(
        telefono
      );


      const [result] =
        await db.query(
          `
          UPDATE clientes
          SET
            ${asignaciones.join(',\n')}
          WHERE telefono = ?
          `,
          valores
        );


      return res.json({
        ok: true,
        actualizados:
          result.affectedRows
      });


    } catch (error) {

      console.error(
        'ERROR GUARDANDO CONTEXTO N8N:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          'No se pudo guardar el contexto',
        detalle:
          error.message
      });

    }
  }
);

app.patch(
  '/api/n8n/clientes/etapa',
  requiereApiN8n,
  async (req, res) => {
    try {
      const telefono =
        normalizarTelefonoEmbudo(
          req.body.telefono
        );

      const etapaEmbudo = String(
        req.body.etapa_embudo || ''
      )
        .trim()
        .toUpperCase();

      if (!telefono) {
        return res.status(400).json({
          ok: false,
          error:
            'El teléfono es obligatorio'
        });
      }

      if (
        !ETAPAS_EMBUDO_VALIDAS.includes(
          etapaEmbudo
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'La etapa del embudo no es válida'
        });
      }

      const actualizado =
        await actualizarEtapaEmbudoPorTelefono(
          telefono,
          etapaEmbudo
        );

      if (!actualizado) {
        return res.status(404).json({
          ok: false,
          error:
            'No se encontró el cliente'
        });
      }

      return res.json({
        ok: true,
        telefono,
        etapa_embudo:
          etapaEmbudo
      });

    } catch (error) {
      console.error(
        'ERROR ACTUALIZANDO EMBUDO DESDE N8N:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          'No se pudo actualizar la etapa'
      });
    }
  }
);

app.get(
  '/api/embudo',
  requiereLogin,
  async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT
          c.id,
          c.nombre,
          c.telefono,
          c.estado,
          c.modo_atencion,
          c.asesor_id,
          c.asesor_nombre,
          c.ultimo_mensaje,
          c.no_leidos,
          c.fecha_creacion,
          c.fecha_actualizacion,

          COALESCE(
            c.etapa_embudo,
            'LEADS_ENTRANTES'
          ) AS etapa_embudo,

          COALESCE(
            c.monto_estimado,
            0
          ) AS monto_estimado,

          EXISTS(
            SELECT 1
            FROM seguimientos s
            WHERE s.cliente_id = c.id
              AND s.estado = 'pendiente'
          ) AS tiene_seguimiento,

          (
            SELECT MIN(s.fecha_programada)
            FROM seguimientos s
            WHERE s.cliente_id = c.id
              AND s.estado = 'pendiente'
          ) AS fecha_seguimiento

        FROM clientes c

        ORDER BY
          c.fecha_actualizacion DESC
      `);

      return res.json(rows);

    } catch (error) {
      console.error(
        'ERROR CARGANDO EMBUDO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);


// =======================================
// SEGUIMIENTOS COMERCIALES
// =======================================

app.get(
  '/api/seguimientos',
  requiereLogin,
  async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT
          s.id,
          s.cliente_id,
          s.asesor_id,
          s.asesor_nombre,
          s.titulo,
          s.nota,
          s.prioridad,
          s.fecha_programada,
          s.estado,
          s.fecha_creacion,
          s.fecha_completado,

          c.nombre AS cliente_nombre,
          c.telefono AS cliente_telefono

        FROM seguimientos s

        INNER JOIN clientes c
          ON c.id = s.cliente_id

        ORDER BY
          CASE
            WHEN s.estado = 'pendiente' THEN 0
            ELSE 1
          END,
          s.fecha_programada ASC
      `);

      return res.json({
        ok: true,
        seguimientos: rows
      });

    } catch (error) {
      console.error(
        'ERROR CARGANDO SEGUIMIENTOS:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  '/api/seguimientos',
  requiereLogin,
  async (req, res) => {
    try {
      const clienteId = Number(
        req.body.cliente_id
      );

      const titulo = String(
        req.body.titulo || ''
      ).trim();

      const nota = String(
        req.body.nota || ''
      ).trim();

      const prioridad = String(
        req.body.prioridad || 'media'
      ).toLowerCase();

      const fechaProgramada = String(
        req.body.fecha_programada || ''
      ).trim();

      const asesorId = req.body.asesor_id
        ? Number(req.body.asesor_id)
        : req.session.usuario?.id || null;

      const asesorNombre =
        String(
          req.body.asesor_nombre ||
          req.session.usuario?.nombre ||
          ''
        ).trim() || null;

      if (!clienteId) {
        return res.status(400).json({
          ok: false,
          error: 'Cliente inválido'
        });
      }

      if (!titulo) {
        return res.status(400).json({
          ok: false,
          error: 'Debes indicar el motivo del seguimiento'
        });
      }

      if (!fechaProgramada) {
        return res.status(400).json({
          ok: false,
          error: 'Debes indicar fecha y hora'
        });
      }

      if (
        !['baja', 'media', 'alta'].includes(
          prioridad
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Prioridad inválida'
        });
      }

      const [clientes] = await db.query(
        `
        SELECT id
        FROM clientes
        WHERE id = ?
        LIMIT 1
        `,
        [clienteId]
      );

      if (!clientes.length) {
        return res.status(404).json({
          ok: false,
          error: 'Cliente no encontrado'
        });
      }

      const [resultado] = await db.query(
        `
        INSERT INTO seguimientos (
          cliente_id,
          asesor_id,
          asesor_nombre,
          titulo,
          nota,
          prioridad,
          fecha_programada,
          estado
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')
        `,
        [
          clienteId,
          asesorId,
          asesorNombre,
          titulo,
          nota || null,
          prioridad,
          fechaProgramada
        ]
      );

      return res.json({
        ok: true,
        id: resultado.insertId
      });

    } catch (error) {
      console.error(
        'ERROR CREANDO SEGUIMIENTO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.patch(
  '/api/seguimientos/:id/completar',
  requiereLogin,
  async (req, res) => {
    try {
      const seguimientoId = Number(
        req.params.id
      );

      const [resultado] = await db.query(
        `
        UPDATE seguimientos
        SET
          estado = 'completado',
          fecha_completado = NOW()
        WHERE id = ?
          AND estado = 'pendiente'
        `,
        [seguimientoId]
      );

      if (!resultado.affectedRows) {
        return res.status(404).json({
          ok: false,
          error: 'Seguimiento no encontrado o ya completado'
        });
      }

      return res.json({
        ok: true
      });

    } catch (error) {
      console.error(
        'ERROR COMPLETANDO SEGUIMIENTO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.delete(
  '/api/seguimientos/:id',
  requiereLogin,
  async (req, res) => {
    try {
      const seguimientoId = Number(
        req.params.id
      );

      await db.query(
        `
        UPDATE seguimientos
        SET estado = 'cancelado'
        WHERE id = ?
        `,
        [seguimientoId]
      );

      return res.json({
        ok: true
      });

    } catch (error) {
      console.error(
        'ERROR CANCELANDO SEGUIMIENTO:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.patch(
  '/api/clientes/:id/etapa',
  requiereLogin,
  async (req, res) => {
    try {
      const clienteId = Number(
        req.params.id
      );

      const etapaEmbudo = String(
        req.body.etapa_embudo || ''
      )
        .trim()
        .toUpperCase();

      const etapasPermitidas = [
        'LEADS_ENTRANTES',
        'ERROR_REORGANIZAR',
        'MENU',
        'RECIBE_INFORMACION',
        'CLIENTES_ESCRIBEN_NUEVAMENTE',
        'ATENDER_LEAD',
        'ATENDIDOS',
        'INTERESADOS',
        'VISITARA_TIENDA',
        'VALIDAR_PAGO',
        'PAGO_CONFIRMADO',
        'PAGO_NO_CONFIRMADO',
        'ENVIAR_COMPROBANTE_ATENDER',
        'DESPACHO',
        'VENTA_GANADA',
        'VENTA_PERDIDA'
      ];

      if (!clienteId) {
        return res.status(400).json({
          ok: false,
          error: 'Cliente inválido'
        });
      }

      if (
        !etapasPermitidas.includes(
          etapaEmbudo
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Etapa del embudo inválida'
        });
      }

      const [resultado] = await db.query(
        `
        UPDATE clientes
        SET
          etapa_embudo = ?,
          fecha_ultimo_movimiento = NOW(),
          fecha_actualizacion = NOW()
        WHERE id = ?
        `,
        [
          etapaEmbudo,
          clienteId
        ]
      );

      if (!resultado.affectedRows) {
        return res.status(404).json({
          ok: false,
          error: 'Cliente no encontrado'
        });
      }

      await registrarAuditoria(
        req,
        'CAMBIAR_ETAPA_EMBUDO',
        'clientes',
        clienteId,
        {
          etapa_embudo: etapaEmbudo
        }
      );

      return res.json({
        ok: true,
        cliente_id: clienteId,
        etapa_embudo: etapaEmbudo
      });

    } catch (error) {
      console.error(
        'ERROR ACTUALIZANDO ETAPA:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);
app.get(
  '/api/permisos/mios',
  requiereLogin,
  async (req, res) => {
    try {
      const usuario =
        await cargarUsuarioSesionCompleto(req);

      if (!usuario) {
        return res.status(404).json({
          ok: false,
          error: 'Usuario no encontrado.'
        });
      }

      return res.json({
        ok: true,
        usuario_id: usuario.id,
        rol: usuario.rol,
        perfil_permisos:
          usuario.perfil_permisos ||
          (
            String(usuario.rol || '').toLowerCase() === 'admin'
              ? 'administrador'
              : 'propios'
          ),
        permisos: usuario.permisos || {}
      });

    } catch (error) {
      console.error(
        'ERROR CARGANDO MIS PERMISOS:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          'No se pudieron cargar los permisos.'
      });
    }
  }
);


// ==========================================================
// SINCRONIZAR IDENTIDAD CON CLIENTE PRINCIPAL DEL CRM
// ==========================================================

async function sincronizarClienteDesdeIdentidad({
  telefono,
  tipoDocumento,
  numeroDocumento,
  nombreCompleto,
  departamento,
  provincia,
  distrito,
  direccion
}) {

  let telefonoLimpio =
    String(telefono || '')
      .replace(/\D/g, '');

  if (telefonoLimpio.length === 9) {
    telefonoLimpio =
      '51' + telefonoLimpio;
  }

  if (!telefonoLimpio) {
    return false;
  }

  const nombre =
    String(
      nombreCompleto || ''
    ).trim();

  const tipo =
    String(
      tipoDocumento || ''
    )
      .trim()
      .toUpperCase();

  const documento =
    String(
      numeroDocumento || ''
    )
      .replace(/\D/g, '');

  const dep =
    String(
      departamento || ''
    ).trim();

  const prov =
    String(
      provincia || ''
    ).trim();

  const dist =
    String(
      distrito || ''
    ).trim();

  const dir =
    String(
      direccion || ''
    ).trim();


  const [resultado] =
    await db.query(
      `
      UPDATE clientes

      SET
        nombre =
          CASE
            WHEN ? <> ''
              THEN ?
            ELSE nombre
          END,

        documento_tipo =
          CASE
            WHEN ? <> ''
              THEN ?
            ELSE documento_tipo
          END,

        documento_numero =
          CASE
            WHEN ? <> ''
              THEN ?
            ELSE documento_numero
          END,

        direccion =
          CASE
            WHEN ? <> ''
              THEN ?
            ELSE direccion
          END,

        departamento =
          CASE
            WHEN ? <> ''
              THEN ?
            ELSE departamento
          END,

        ciudad =
          CASE
            WHEN ? <> ''
              THEN ?
            ELSE ciudad
          END,

        distrito =
          CASE
            WHEN ? <> ''
              THEN ?
            ELSE distrito
          END,

        fecha_actualizacion =
          NOW()

      WHERE telefono = ?
      `,
      [
        nombre,
        nombre,

        tipo,
        tipo,

        documento,
        documento,

        dir,
        dir,

        dep,
        dep,

        prov,
        prov,

        dist,
        dist,

        telefonoLimpio
      ]
    );


  console.log(
    'IDENTIDAD SINCRONIZADA CON CRM:',
    {
      telefono: telefonoLimpio,
      nombre,
      documento,
      actualizado:
        resultado.affectedRows > 0
    }
  );


  return (
    resultado.affectedRows > 0
  );
}


// ==========================================================
// CONSULTAR DNI
// BASE ZR MEDIC -> FACTILIZA -> GUARDAR -> RESPONDER
// ==========================================================

app.get(
  '/api/n8n/clientes/documento/dni/:dni',
  async (req, res) => {

    try {

      // ------------------------------------------------------
      // 1. VALIDAR API KEY DE N8N
      // ------------------------------------------------------

      const apiKey = String(
        req.headers['x-api-key'] || ''
      ).trim();

      if (
        process.env.N8N_API_KEY &&
        apiKey !== process.env.N8N_API_KEY
      ) {
        return res.status(401).json({
          ok: false,
          error: 'No autorizado'
        });
      }


      // ------------------------------------------------------
      // 2. VALIDAR DNI
      // ------------------------------------------------------

      const dni = String(
        req.params.dni || ''
      ).replace(/\D/g, '');

      if (!/^\d{8}$/.test(dni)) {
        return res.status(400).json({
          ok: false,
          encontrado: false,
          error: 'El DNI debe contener exactamente 8 dígitos.'
        });
      }
       
      // ------------------------------------------------------
// RECUPERAR TELEFONO DEL CLIENTE
// ------------------------------------------------------

let telefono = String(
  req.query.telefono || ''
).replace(/\D/g, '');

if (telefono.length === 9) {
  telefono = '51' + telefono;
}

if (
  telefono &&
  !/^51\d{9}$/.test(telefono)
) {
  return res.status(400).json({
    ok: false,
    encontrado: false,
    error: 'El teléfono no tiene un formato válido.'
  });
}
   
      // ------------------------------------------------------
      // 3. BUSCAR PRIMERO EN NUESTRA BASE
      // ------------------------------------------------------

      const [clientes] = await db.query(
        `
        SELECT
          id,
          telefono,
          tipo_documento,
          numero_documento,
          nombres,
          apellido_paterno,
          apellido_materno,
          nombre_completo,
          departamento,
          provincia,
          distrito,
          direccion_registrada,
          direccion_completa_registrada,
          ubigeo_reniec,
          ubigeo_sunat,
          fuente,
          fecha_consulta,
          updated_at
        FROM clientes_identidad
        WHERE tipo_documento = ?
          AND numero_documento = ?
        LIMIT 1
        `,
        ['dni', dni]
      );


      // ------------------------------------------------------
      // 4. SI EXISTE -> DEVOLVER SIN CONSULTAR FACTILIZA
      // ------------------------------------------------------

   // ------------------------------------------------------
// 4. SI EXISTE EN NUESTRA BASE
// VALIDAR QUE NO TENGA CODIFICACIÓN DAÑADA
// ------------------------------------------------------

if (clientes.length > 0) {

  const cliente =
    clientes[0];


  // =============================================
  // DETECTAR DATOS CORRUPTOS
  // =============================================

  const datosCacheCorruptos =
    [
      cliente.nombres,
      cliente.apellido_paterno,
      cliente.apellido_materno,
      cliente.nombre_completo,
      cliente.departamento,
      cliente.provincia,
      cliente.distrito,
      cliente.direccion_registrada,
      cliente.direccion_completa_registrada
    ].some(
      textoTieneCodificacionRota
    );


  // =============================================
  // SI LOS DATOS ESTÁN BIEN
  // USAR NUESTRA BASE
  // =============================================

  if (!datosCacheCorruptos) {

    if (telefono) {

      // Eliminar otra identidad anterior
      // asociada al mismo WhatsApp

      await db.query(
        `
        DELETE FROM clientes_identidad

        WHERE telefono = ?

          AND NOT (
            tipo_documento = 'dni'
            AND numero_documento = ?
          )
        `,
        [
          telefono,
          dni
        ]
      );


      // Asociar DNI actual al WhatsApp

      await db.query(
        `
        UPDATE clientes_identidad

        SET
          telefono = ?,
          updated_at = NOW()

        WHERE tipo_documento = 'dni'
          AND numero_documento = ?
        `,
        [
          telefono,
          dni
        ]
      );


await sincronizarClienteDesdeIdentidad({

  telefono,

  tipoDocumento:
    'DNI',

  numeroDocumento:
    cliente.numero_documento,

  nombreCompleto:
    cliente.nombre_completo,

  departamento:
    cliente.departamento,

  provincia:
    cliente.provincia,

  distrito:
    cliente.distrito,

  direccion:
    cliente.direccion_completa_registrada ||
    cliente.direccion_registrada ||
    ''

});

    }

   
    // =============================================
    // DEVOLVER DATOS CORRECTOS DESDE LA BASE
    // =============================================

    return res.json({

      ok: true,

      encontrado: true,

      fuente:
        'base_zrmedic',

      tipo_documento:
        'dni',

      numero_documento:
        cliente.numero_documento,

      nombres:
        cliente.nombres || '',

      apellido_paterno:
        cliente.apellido_paterno || '',

      apellido_materno:
        cliente.apellido_materno || '',

      nombre_completo:
        cliente.nombre_completo || '',

      departamento:
        cliente.departamento || '',

      provincia:
        cliente.provincia || '',

      distrito:
        cliente.distrito || '',

      direccion_registrada:
        cliente.direccion_registrada || '',

      direccion_completa_registrada:
        cliente.direccion_completa_registrada || '',

      ubigeo_reniec:
        cliente.ubigeo_reniec || '',

      ubigeo_sunat:
        cliente.ubigeo_sunat || ''

    });

  }


  // =============================================
  // SI LOS DATOS ESTÁN CORRUPTOS
  // NO HACER RETURN
  //
  // CONTINUAR HACIA FACTILIZA
  // =============================================

  console.warn(
    `DNI ${dni}: datos con codificación dañada detectados. Se volverá a consultar Factiliza.`
  );

}


      // ------------------------------------------------------
      // 5. SI NO EXISTE -> CONSULTAR FACTILIZA
      // ------------------------------------------------------

      const tokenFactiliza = String(
        process.env.FACTILIZA_TOKEN || ''
      ).trim();

      if (!tokenFactiliza) {
        console.error(
          'FACTILIZA_TOKEN no está configurado'
        );

        return res.status(500).json({
          ok: false,
          encontrado: false,
          error:
            'El servicio de consulta de documentos no está configurado.'
        });
      }


      // Timeout para evitar que n8n quede esperando indefinidamente
      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          10000
        );

      let respuestaFactiliza;

      try {

        respuestaFactiliza = await fetch(
          `https://api.factiliza.com/v1/dni/info/${dni}`,
          {
            method: 'GET',

            headers: {
              Authorization:
                `Bearer ${tokenFactiliza}`,

              Accept:
                'application/json'
            },

            signal:
              controller.signal
          }
        );

      } finally {

        clearTimeout(timeout);

      }


      // ------------------------------------------------------
      // 6. LEER RESPUESTA FACTILIZA
      // ------------------------------------------------------
let resultado;

try {

  // Obtener los bytes originales.
  const arrayBuffer =
    await respuestaFactiliza.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);


  // =========================================
  // PRIMER INTENTO: UTF-8
  // =========================================

  let textoRespuesta =
    buffer.toString('utf8');


  // =========================================
  // SI APARECE �, INTENTAR WINDOWS-1252
  // =========================================

  if (
    textoRespuesta.includes('\uFFFD')
  ) {

    console.warn(
      'Factiliza devolvió caracteres no válidos en UTF-8. Intentando Windows-1252.'
    );

    try {

      const decoder =
        new TextDecoder(
          'windows-1252'
        );

      const alternativa =
        decoder.decode(buffer);

      if (
        alternativa &&
        !alternativa.includes('\uFFFD')
      ) {
        textoRespuesta =
          alternativa;
      }

    } catch (errorEncoding) {

      console.warn(
        'No se pudo aplicar Windows-1252:',
        errorEncoding.message
      );

    }
  }


  resultado =
    JSON.parse(
      textoRespuesta
    );


} catch (error) {

  console.error(
    'ERROR DECODIFICANDO FACTILIZA:',
    error
  );

  return res.status(502).json({
    ok: false,
    encontrado: false,
    error:
      'Factiliza devolvió una respuesta inválida.'
  });

}


      // ------------------------------------------------------
      // 7. VALIDAR RESPUESTA
      // ------------------------------------------------------

      if (
        !respuestaFactiliza.ok ||
        resultado?.success !== true ||
        !resultado?.data
      ) {

        console.error(
          'Error Factiliza:',
          resultado
        );

        return res.status(
          respuestaFactiliza.status || 404
        ).json({

          ok: false,
          encontrado: false,

          tipo_documento: 'dni',
          numero_documento: dni,

          error:
            resultado?.message ||
            'No se encontraron datos para el DNI indicado.'
        });
      }


      // ------------------------------------------------------
      // 8. NORMALIZAR DATOS
      // ------------------------------------------------------

      const persona =
        resultado.data;

      const datos = {

  tipo_documento:
    'dni',

  numero_documento:
    String(
      persona.numero || dni
    ).trim(),

  nombres:
    repararTexto(
      persona.nombres
    ),

  apellido_paterno:
    repararTexto(
      persona.apellido_paterno
    ),

  apellido_materno:
    repararTexto(
      persona.apellido_materno
    ),

  nombre_completo:
    repararTexto(
      persona.nombre_completo
    ),

  departamento:
    repararTexto(
      persona.departamento
    ),

  provincia:
    repararTexto(
      persona.provincia
    ),

  distrito:
    repararTexto(
      persona.distrito
    ),

  direccion_registrada:
    repararTexto(
      persona.direccion
    ),

  direccion_completa_registrada:
    repararTexto(
      persona.direccion_completa
    ),

  ubigeo_reniec:
    String(
      persona.ubigeo_reniec || ''
    ).trim(),

  ubigeo_sunat:
    String(
      persona.ubigeo_sunat || ''
    ).trim()
};
// ------------------------------------------------------
// 9.1 ELIMINAR DNI ANTERIOR DEL MISMO TELEFONO
// ------------------------------------------------------

if (telefono) {

  await db.execute(
    `
    DELETE FROM clientes_identidad
    WHERE telefono = ?
      AND NOT (
        tipo_documento = 'dni'
        AND numero_documento = ?
      )
    `,
    [
      telefono,
      datos.numero_documento
    ]
  );

}
      // ------------------------------------------------------
      // 9. GUARDAR EN NUESTRA BASE
      // ------------------------------------------------------
      await db.execute(
  `
  INSERT INTO clientes_identidad (
    telefono,
    tipo_documento,
    numero_documento,
    nombres,
    apellido_paterno,
    apellido_materno,
    nombre_completo,
    departamento,
    provincia,
    distrito,
    direccion_registrada,
    direccion_completa_registrada,
    ubigeo_reniec,
    ubigeo_sunat,
    fuente,
    fecha_consulta
  )
  VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, NOW()
  )

  ON DUPLICATE KEY UPDATE

    telefono =
      VALUES(telefono),

    nombres =
      VALUES(nombres),

    apellido_paterno =
      VALUES(apellido_paterno),

    apellido_materno =
      VALUES(apellido_materno),

    nombre_completo =
      VALUES(nombre_completo),

    departamento =
      VALUES(departamento),

    provincia =
      VALUES(provincia),

    distrito =
      VALUES(distrito),

    direccion_registrada =
      VALUES(direccion_registrada),

    direccion_completa_registrada =
      VALUES(direccion_completa_registrada),

    ubigeo_reniec =
      VALUES(ubigeo_reniec),

    ubigeo_sunat =
      VALUES(ubigeo_sunat),

    fuente =
      VALUES(fuente),

    fecha_consulta =
      NOW(),

    updated_at =
      NOW()
  `,
  [
    telefono || null,

    datos.tipo_documento,
    datos.numero_documento,

    datos.nombres,
    datos.apellido_paterno,
    datos.apellido_materno,
    datos.nombre_completo,

    datos.departamento,
    datos.provincia,
    datos.distrito,

    datos.direccion_registrada,
    datos.direccion_completa_registrada,

    datos.ubigeo_reniec,
    datos.ubigeo_sunat,

    'factiliza'
  ]
);




if (telefono) {

  await sincronizarClienteDesdeIdentidad({

    telefono,

    tipoDocumento:
      'DNI',

    numeroDocumento:
      datos.numero_documento,

    nombreCompleto:
      datos.nombre_completo,

    departamento:
      datos.departamento,

    provincia:
      datos.provincia,

    distrito:
      datos.distrito,

    direccion:
      datos.direccion_completa_registrada ||
      datos.direccion_registrada ||
      ''

  });

}


      // ------------------------------------------------------
      // 10. DEVOLVER DATOS A N8N
      // ------------------------------------------------------

      return res.json({

        ok: true,
        encontrado: true,

        fuente:
          'factiliza',

        ...datos
      });


    } catch (error) {

      console.error(
        'Error consultando DNI:',
        error
      );


      // Timeout Factiliza
      if (
        error?.name ===
        'AbortError'
      ) {

        return res.status(504).json({
          ok: false,
          encontrado: false,
          error:
            'Factiliza tardó demasiado en responder.'
        });

      }


      return res.status(500).json({
        ok: false,
        encontrado: false,
        error:
          'Error interno al consultar el DNI.'
      });

    }

  }
);
// ==========================================================
// ACTUALIZAR DATOS DE IDENTIDAD
// CONFIRMADOS / CORREGIDOS POR EL CLIENTE
// ==========================================================

app.patch(
  '/api/n8n/clientes/documento/dni/:dni',
  requiereApiN8n,
  async (req, res) => {

    try {

      // =====================================================
      // 1. VALIDAR DNI
      // =====================================================

      const dni = String(
        req.params.dni || ''
      ).replace(/\D/g, '');


      if (!/^\d{8}$/.test(dni)) {

        return res.status(400).json({
          ok: false,
          error:
            'El DNI debe contener exactamente 8 dígitos.'
        });

      }


      // =====================================================
      // 2. RECUPERAR TELÉFONO
      // =====================================================

    // ------------------------------------------------------
// RECUPERAR TELEFONO DEL CLIENTE
// ------------------------------------------------------

let telefono = String(
  req.query.telefono || ''
).replace(/\D/g, '');

if (telefono.length === 9) {
  telefono = '51' + telefono;
}

if (
  telefono &&
  !/^51\d{9}$/.test(telefono)
) {
  return res.status(400).json({
    ok: false,
    encontrado: false,
    error: 'El teléfono no tiene un formato válido.'
  });
}


      // =====================================================
      // 3. BUSCAR DATOS ACTUALES
      // =====================================================

      const [identidades] =
        await db.query(
          `
          SELECT
            id,
            telefono,
            tipo_documento,
            numero_documento,
            nombres,
            apellido_paterno,
            apellido_materno,
            nombre_completo,
            departamento,
            provincia,
            distrito,
            direccion_registrada,
            direccion_completa_registrada,
            ubigeo_reniec,
            ubigeo_sunat

          FROM clientes_identidad

          WHERE tipo_documento = 'dni'
            AND numero_documento = ?

          LIMIT 1
          `,
          [dni]
        );


      if (!identidades.length) {

        return res.status(404).json({
          ok: false,
          error:
            'El DNI no existe todavía en la base de identidad. Consúltalo primero.'
        });

      }


      const actual =
        identidades[0];


      // =====================================================
      // 4. RECIBIR LOS NUEVOS DATOS
      // =====================================================

      const nombreCompleto = String(
        req.body.nombre_completo ??
        actual.nombre_completo ??
        ''
      ).trim();


      const departamento = String(
        req.body.departamento ??
        actual.departamento ??
        ''
      ).trim();


      const provincia = String(
        req.body.provincia ??
        actual.provincia ??
        ''
      ).trim();


      const distrito = String(
        req.body.distrito ??
        actual.distrito ??
        ''
      ).trim();


      const direccionRegistrada =
        String(
          req.body.direccion_registrada ??
          actual.direccion_registrada ??
          ''
        ).trim();


      // Construir nuevamente la dirección completa

      const direccionCompleta = [

        direccionRegistrada,

        [
          departamento,
          provincia,
          distrito
        ]
          .filter(Boolean)
          .join(' - ')

      ]
        .filter(Boolean)
        .join(', ');


      // =====================================================
      // 5. ACTUALIZAR clientes_identidad
      // =====================================================

      await db.query(
        `
        UPDATE clientes_identidad

        SET

          telefono = CASE
            WHEN ? <> ''
            THEN ?
            ELSE telefono
          END,

          nombre_completo = ?,

          departamento = ?,

          provincia = ?,

          distrito = ?,

          direccion_registrada = ?,

          direccion_completa_registrada = ?,

          fuente = 'cliente_actualizado',

          fecha_consulta = NOW(),

          updated_at = NOW()

        WHERE tipo_documento = 'dni'
          AND numero_documento = ?
        `,
        [

          telefono,
          telefono,

          nombreCompleto,

          departamento,

          provincia,

          distrito,

          direccionRegistrada,

          direccionCompleta,

          dni
        ]
      );


      // =====================================================
      // 6. PREPARAR OBJETO ACTUALIZADO
      // =====================================================

      const datosIdentidad = {

        tipo_documento:
          'dni',

        numero_documento:
          dni,

        nombre_completo:
          nombreCompleto,

        nombres:
          actual.nombres || '',

        apellido_paterno:
          actual.apellido_paterno || '',

        apellido_materno:
          actual.apellido_materno || '',

        departamento,

        provincia,

        distrito,

        direccion_registrada:
          direccionRegistrada,

        direccion_completa_registrada:
          direccionCompleta,

        ubigeo_reniec:
          actual.ubigeo_reniec || '',

        ubigeo_sunat:
          actual.ubigeo_sunat || '',

        fuente:
          'cliente_actualizado'
      };


      // =====================================================
      // 7. ACTUALIZAR TAMBIÉN TABLA clientes
      // =====================================================

      if (telefono) {

        await db.query(
          `
          UPDATE clientes

          SET

            nombre = CASE
              WHEN ? <> ''
              THEN ?
              ELSE nombre
            END,

            documento_tipo = 'DNI',

            documento_numero = ?,

            direccion = ?,

            distrito = ?,

            ciudad = ?,

            departamento = ?,

            datos_entrega = ?,

            fecha_actualizacion = NOW()

          WHERE telefono = ?
          `,
          [

            nombreCompleto,
            nombreCompleto,

            dni,

            direccionRegistrada,

            distrito,

            provincia,

            departamento,

            JSON.stringify(
              datosIdentidad
            ),

            telefono
          ]
        );

      }


      // =====================================================
      // 8. RESPUESTA A N8N
      // =====================================================

      return res.json({

        ok: true,

        actualizado: true,

        fuente:
          'cliente_actualizado',

        datos:
          datosIdentidad

      });


    } catch (error) {

      console.error(
        'ERROR ACTUALIZANDO IDENTIDAD:',
        error
      );


      return res.status(500).json({

        ok: false,

        error:
          'No se pudieron actualizar los datos de identidad.',

        detalle:
          error.message

      });

    }

  }
);

 // =======================================
// LISTAR PEDIDOS PARA FACTURACIÓN
// =======================================

app.get(
  '/api/pedidos',
  requiereCajaOAdmin,
  async (req, res) => {
    try {
      const [pedidos] =
        await db.query(
          `
          SELECT
            id,
            codigo,
            pago_id,
            cliente_id,

            cliente_nombre,
            tipo_documento,
            numero_documento,
            correo,
            telefono,

            tipo_entrega,
            direccion,
            referencia,
            distrito,
            ciudad,
            departamento,
            agencia,

            subtotal_productos,
            costo_delivery,
            total,

            medio_pago_confirmado,

            estado_pedido,
            estado_facturacion,

            tipo_comprobante,
            factura_pdf_url,
            factura_xml_url,

            fecha_pago,
            fecha_facturacion,
            fecha_envio_correo,
            fecha_creacion,
            fecha_actualizacion

          FROM pedidos

          ORDER BY
            fecha_creacion DESC

          LIMIT 250
          `
        );

      const ids =
        pedidos
          .map(item =>
            Number(item.id)
          )
          .filter(Boolean);

      let items = [];

      if (ids.length) {
        const placeholders =
          ids
            .map(() => '?')
            .join(',');

        const [rows] =
          await db.query(
            `
            SELECT
              id,
              pedido_id,
              sku,
              nombre_producto,
              cantidad,
              precio_unitario,
              subtotal

            FROM pedido_items

            WHERE pedido_id IN (
              ${placeholders}
            )

            ORDER BY
              pedido_id ASC,
              id ASC
            `,
            ids
          );

        items = rows;
      }

      const itemsPorPedido =
        new Map();

      for (const item of items) {
        const clave =
          Number(
            item.pedido_id
          );

        if (
          !itemsPorPedido.has(clave)
        ) {
          itemsPorPedido.set(
            clave,
            []
          );
        }

        itemsPorPedido
          .get(clave)
          .push(item);
      }

      const salida =
        pedidos.map(
          pedido => ({
            ...pedido,

            items:
              itemsPorPedido.get(
                Number(pedido.id)
              ) || []
          })
        );

      return res.json({
        ok: true,
        pedidos: salida
      });

    } catch (error) {
      console.error(
        'ERROR LISTANDO PEDIDOS:',
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);


// =======================================
// CARGAR FACTURACIÓN Y ENVIAR CORREO
// =======================================

app.post(
  '/api/pedidos/:id/facturacion',

  requiereCajaOAdmin,

  upload.fields([
    {
      name: 'pdf',
      maxCount: 1
    },
    {
      name: 'xml',
      maxCount: 1
    }
  ]),

  async (req, res) => {

    const archivosTemporales = [
      ...(req.files?.pdf || []),
      ...(req.files?.xml || [])
    ];

    try {
      const pedidoId =
        Number(req.params.id);

      if (
        !Number.isInteger(pedidoId) ||
        pedidoId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'ID de pedido inválido.'
        });
      }

      const pedidoAnterior =
        await obtenerPedidoCompleto(
          pedidoId
        );

      if (!pedidoAnterior) {
        return res.status(404).json({
          ok: false,
          error:
            'Pedido no encontrado.'
        });
      }

      const correo = String(
        req.body.correo ||
        pedidoAnterior.correo ||
        ''
      ).trim();

      const tipoComprobante =
        String(
          req.body.tipo_comprobante ||
          pedidoAnterior.tipo_comprobante ||
          'boleta'
        )
          .trim()
          .toLowerCase();

      if (!correo) {
        return res.status(400).json({
          ok: false,
          error:
            'El correo del cliente es obligatorio.'
        });
      }

      if (
        ![
          'boleta',
          'factura'
        ].includes(
          tipoComprobante
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'Tipo de comprobante inválido.'
        });
      }

      const archivoPdf =
        req.files?.pdf?.[0] ||
        null;

      const archivoXml =
        req.files?.xml?.[0] ||
        null;


      // ==========================================
      // VALIDAR PDF
      // ==========================================

      if (
        archivoPdf &&
        !String(
          archivoPdf.originalname ||
          ''
        )
          .toLowerCase()
          .endsWith('.pdf')
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'El archivo PDF debe tener extensión .pdf.'
        });
      }


      // ==========================================
      // VALIDAR XML
      // ==========================================

      if (
        archivoXml &&
        !String(
          archivoXml.originalname ||
          ''
        )
          .toLowerCase()
          .endsWith('.xml')
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'El archivo XML debe tener extensión .xml.'
        });
      }


      // ==========================================
      // GUARDAR PDF
      // ==========================================

      const pdfUrl =
        archivoPdf
          ? moverArchivoFacturacion({
              archivo:
                archivoPdf,

              pedidoId,

              tipo:
                'factura'
            })

          : pedidoAnterior
              .factura_pdf_url ||
            null;


      // ==========================================
      // GUARDAR XML
      // ==========================================

      const xmlUrl =
        archivoXml
          ? moverArchivoFacturacion({
              archivo:
                archivoXml,

              pedidoId,

              tipo:
                'xml'
            })

          : pedidoAnterior
              .factura_xml_url ||
            null;


      // ==========================================
      // VALIDAR QUE HAYA COMPROBANTE
      // ==========================================

      if (!pdfUrl && !xmlUrl) {
        return res.status(400).json({
          ok: false,
          error:
            'Carga al menos el PDF o XML del comprobante.'
        });
      }


      // ==========================================
      // ACTUALIZAR PEDIDO
      // ==========================================

      await db.query(
        `
        UPDATE pedidos
        SET
          correo = ?,

          tipo_comprobante = ?,

          factura_pdf_url = ?,

          factura_xml_url = ?,

          estado_facturacion =
            'cargado',

          facturado_por = ?,

          facturado_por_nombre = ?,

          fecha_facturacion =
            NOW(),

          fecha_actualizacion =
            NOW()

        WHERE id = ?
        `,
        [
          correo,

          tipoComprobante,

          pdfUrl,

          xmlUrl,

          req.session.usuario?.id ||
            null,

          req.session.usuario?.nombre ||
            null,

          pedidoId
        ]
      );


      // ==========================================
      // GUARDAR CORREO EN CLIENTE
      // ==========================================

      if (
        pedidoAnterior.cliente_id
      ) {
        await db.query(
          `
          UPDATE clientes
          SET
            correo = ?,

            etapa_embudo =
              'ENVIAR_COMPROBANTE_ATENDER',

            fecha_ultimo_movimiento =
              NOW(),

            fecha_actualizacion =
              NOW()

          WHERE id = ?
          `,
          [
            correo,

            pedidoAnterior.cliente_id
          ]
        );
      }


      // ==========================================
      // INTENTAR ENVIAR CORREO
      // ==========================================

      let correoEnviado =
        false;

      let avisoCorreo =
        '';

      let messageId =
        null;


      try {
        const pedidoActualizado =
          await obtenerPedidoCompleto(
            pedidoId
          );

        messageId =
          await enviarCorreoFacturacion(
            pedidoActualizado
          );

        correoEnviado =
          true;


        // ========================================
        // MARCAR COMO FACTURADO / LISTO
        // ========================================

        await db.query(
          `
          UPDATE pedidos
          SET
            estado_facturacion =
              'enviado',

            estado_pedido =
              'listo_despacho',

            fecha_envio_correo =
              NOW(),

            fecha_actualizacion =
              NOW()

          WHERE id = ?
          `,
          [
            pedidoId
          ]
        );


        // ========================================
        // ACTUALIZAR EMBUDO DEL CLIENTE
        // ========================================

        if (
          pedidoAnterior.cliente_id
        ) {
          await db.query(
            `
            UPDATE clientes
            SET
              etapa_embudo =
                'DESPACHO',

              fecha_ultimo_movimiento =
                NOW(),

              fecha_actualizacion =
                NOW()

            WHERE id = ?
            `,
            [
              pedidoAnterior.cliente_id
            ]
          );
        }

      } catch (errorCorreo) {

        avisoCorreo =
          errorCorreo.message;

        console.error(
          'FACTURACIÓN GUARDADA, PERO CORREO NO ENVIADO:',
          errorCorreo.message
        );
      }


      // ==========================================
      // AUDITORÍA
      // ==========================================

      await registrarAuditoria(
        req,

        'CARGAR_FACTURACION',

        'pedidos',

        pedidoId,

        {
          correo,

          tipo_comprobante:
            tipoComprobante,

          pdf:
            pdfUrl,

          xml:
            xmlUrl,

          correo_enviado:
            correoEnviado,

          correo_message_id:
            messageId
        }
      );


      // ==========================================
      // RESPUESTA
      // ==========================================

      return res.json({
        ok: true,

        pedido_id:
          pedidoId,

        factura_pdf_url:
          pdfUrl,

        factura_xml_url:
          xmlUrl,

        correo_enviado:
          correoEnviado,

        aviso_correo:
          avisoCorreo,

        correo_message_id:
          messageId
      });

    } catch (error) {

      // ==========================================
      // LIMPIAR ARCHIVOS TEMPORALES
      // ==========================================

      for (
        const archivo
        of archivosTemporales
      ) {
        try {

          if (
            archivo?.path &&
            fs.existsSync(
              archivo.path
            )
          ) {

            fs.unlinkSync(
              archivo.path
            );

          }

        } catch (errorLimpieza) {

          // No interrumpir la respuesta.

        }
      }


      console.error(
        'ERROR CARGANDO FACTURACIÓN:',
        error
      );


      return res.status(500).json({
        ok: false,

        error:
          error.message
      });
    }
  }
);


// =======================================
// REENVIAR COMPROBANTE POR CORREO
// =======================================

app.post(
  '/api/pedidos/:id/enviar-correo',

  requiereCajaOAdmin,

  async (req, res) => {
    try {

      const pedidoId =
        Number(req.params.id);


      // ==========================================
      // BUSCAR PEDIDO
      // ==========================================

      const pedido =
        await obtenerPedidoCompleto(
          pedidoId
        );


      if (!pedido) {
        return res.status(404).json({
          ok: false,

          error:
            'Pedido no encontrado.'
        });
      }


      // ==========================================
      // CORREO
      // ==========================================

      const correo = String(
        req.body.correo ||
        pedido.correo ||
        ''
      ).trim();


      if (!correo) {
        return res.status(400).json({
          ok: false,

          error:
            'El correo del cliente es obligatorio.'
        });
      }


      pedido.correo =
        correo;


      // ==========================================
      // ACTUALIZAR PEDIDO
      // ==========================================

      await db.query(
        `
        UPDATE pedidos
        SET
          correo = ?,

          fecha_actualizacion =
            NOW()

        WHERE id = ?
        `,
        [
          correo,

          pedidoId
        ]
      );


      // ==========================================
      // ACTUALIZAR CLIENTE
      // ==========================================

      if (
        pedido.cliente_id
      ) {
        await db.query(
          `
          UPDATE clientes
          SET
            correo = ?,

            fecha_actualizacion =
              NOW()

          WHERE id = ?
          `,
          [
            correo,

            pedido.cliente_id
          ]
        );
      }


      // ==========================================
      // ENVIAR CORREO
      // ==========================================

      const messageId =
        await enviarCorreoFacturacion(
          pedido
        );


      // ==========================================
      // CAMBIAR ESTADOS
      // ==========================================

      await db.query(
        `
        UPDATE pedidos
        SET
          estado_facturacion =
            'enviado',

          estado_pedido =
            'listo_despacho',

          fecha_envio_correo =
            NOW(),

          fecha_actualizacion =
            NOW()

        WHERE id = ?
        `,
        [
          pedidoId
        ]
      );


      // ==========================================
      // AUDITORÍA
      // ==========================================

      await registrarAuditoria(
        req,

        'REENVIAR_FACTURA_CORREO',

        'pedidos',

        pedidoId,

        {
          correo,

          message_id:
            messageId
        }
      );


      // ==========================================
      // RESPUESTA
      // ==========================================

      return res.json({
        ok: true,

        pedido_id:
          pedidoId,

        correo,

        message_id:
          messageId
      });

    } catch (error) {

      console.error(
        'ERROR ENVIANDO FACTURA POR CORREO:',
        error
      );


      return res.status(500).json({
        ok: false,

        error:
          error.message
      });
    }
  }
);


// =======================================
// ETIQUETA AUTOMATIZADA 10 x 15 CM
// =======================================

app.get(
  '/api/pedidos/:id/etiqueta.pdf',

  requiereCajaOAdmin,

  async (req, res) => {
    try {

      const pedidoId =
        Number(req.params.id);


      // ==========================================
      // BUSCAR PEDIDO
      // ==========================================

      const pedido =
        await obtenerPedidoCompleto(
          pedidoId
        );


      if (!pedido) {
        return res.status(404).json({
          ok: false,

          error:
            'Pedido no encontrado.'
        });
      }


      // ==========================================
      // CARGAR PDFKIT
      // ==========================================

      let PDFDocument;


      try {

        PDFDocument =
          require('pdfkit');

      } catch (error) {

        return res.status(500).json({
          ok: false,

          error:
            'Falta instalar pdfkit. Ejecuta: npm install pdfkit'
        });

      }


      // ==========================================
      // CÓDIGO DEL PEDIDO
      // ==========================================

      const codigo =
        pedido.codigo ||
        `PED-${pedido.id}`;


      const nombreArchivo =
        `Etiqueta-${textoSeguroArchivo(
          codigo
        )}.pdf`;


      // ==========================================
      // HEADERS PDF
      // ==========================================

      res.setHeader(
        'Content-Type',
        'application/pdf'
      );


      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreArchivo}"`
      );


      // ==========================================
      // CREAR PDF 10 x 15 CM
      // ==========================================

      const doc =
        new PDFDocument({
          size: [
            283.46,
            425.20
          ],

          margin:
            18
        });


      doc.pipe(res);


      // ==========================================
      // CABECERA ZR MEDIC
      // ==========================================

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text(
          'ZR MEDIC',
          {
            align:
              'center'
          }
        );


      doc
        .moveDown(0.15)

        .font('Helvetica')

        .fontSize(8)

        .fillColor('#52635f')

        .text(
          'PEDIDO / DESPACHO',
          {
            align:
              'center'
          }
        );


      doc
        .moveDown(0.6)

        .fillColor('#000000');


      // ==========================================
      // CÓDIGO DEL PEDIDO
      // ==========================================

      doc
        .font('Helvetica-Bold')

        .fontSize(15)

        .text(
          codigo,
          {
            align:
              'center'
          }
        );


      doc
        .moveDown(0.8);


      // ==========================================
      // SEPARADOR
      // ==========================================

      const linea = () => {

        doc
          .moveDown(0.25)

          .strokeColor('#b8c6c2')

          .lineWidth(0.6)

          .moveTo(
            18,
            doc.y
          )

          .lineTo(
            265,
            doc.y
          )

          .stroke()

          .moveDown(0.55);

      };


      linea();


      // ==========================================
      // CLIENTE
      // ==========================================

      doc
        .font('Helvetica-Bold')

        .fontSize(9)

        .text(
          'CLIENTE'
        );


      doc
        .font('Helvetica-Bold')

        .fontSize(12)

        .text(
          String(
            pedido.cliente_nombre ||
            'Cliente'
          )
        );


      doc
        .font('Helvetica')

        .fontSize(9)

        .text(
          `Tel: ${
            pedido.telefono ||
            '-'
          }`
        );


      if (
        pedido.numero_documento
      ) {

        doc.text(
          `${String(
            pedido.tipo_documento ||
            'Documento'
          ).toUpperCase()}: ${
            pedido.numero_documento
          }`
        );

      }


      linea();


      // ==========================================
      // ENTREGA
      // ==========================================

      doc
        .font('Helvetica-Bold')

        .fontSize(9)

        .text(
          'ENTREGA'
        );


      doc
        .font('Helvetica')

        .fontSize(10)

        .text(
          `Modalidad: ${
            pedido.tipo_entrega ||
            'No especificada'
          }`
        );


      // ==========================================
      // DIRECCIÓN
      // ==========================================

      if (
        pedido.direccion
      ) {

        doc
          .font('Helvetica-Bold')

          .fontSize(10)

          .text(
            String(
              pedido.direccion
            ),

            {
              width:
                245
            }
          );

      }


      // ==========================================
      // UBICACIÓN
      // ==========================================

      const ubicacion = [

        pedido.distrito,

        pedido.ciudad,

        pedido.departamento

      ]
        .filter(Boolean)

        .join(' - ');


      if (
        ubicacion
      ) {

        doc
          .font('Helvetica')

          .fontSize(9)

          .text(
            ubicacion
          );

      }


      // ==========================================
      // REFERENCIA
      // ==========================================

      if (
        pedido.referencia
      ) {

        doc
          .fontSize(8)

          .text(
            `Referencia: ${
              pedido.referencia
            }`
          );

      }


      // ==========================================
      // AGENCIA
      // ==========================================

      if (
        pedido.agencia
      ) {

        doc
          .font('Helvetica-Bold')

          .fontSize(9)

          .text(
            `Agencia: ${
              pedido.agencia
            }`
          );

      }


      linea();


      // ==========================================
      // PRODUCTOS
      // ==========================================

      doc
        .font('Helvetica-Bold')

        .fontSize(9)

        .text(
          'CONTENIDO'
        );


      const items =
        Array.isArray(
          pedido.items
        )
          ? pedido.items
          : [];


      const maxItems =
        5;


      items
        .slice(
          0,
          maxItems
        )
        .forEach(
          item => {

            doc
              .font('Helvetica')

              .fontSize(8.5)

              .text(
                `${
                  item.cantidad ||
                  1
                } x ${
                  item.nombre_producto ||
                  ''
                }`,

                {
                  width:
                    245
                }
              );

          }
        );


      // ==========================================
      // SI HAY MÁS DE 5 PRODUCTOS
      // ==========================================

      if (
        items.length >
        maxItems
      ) {

        doc
          .fontSize(8)

          .text(
            `+ ${
              items.length -
              maxItems
            } producto(s) adicional(es)`
          );

      }


      // ==========================================
      // PIE
      // ==========================================

      doc
        .moveDown(0.7)

        .font('Helvetica-Bold')

        .fontSize(8)

        .fillColor('#52635f')

        .text(
          'Generado automáticamente por el CRM ZR MEDIC',

          {
            align:
              'center'
          }
        );


      // ==========================================
      // FINALIZAR PDF
      // ==========================================

      doc.end();


    } catch (error) {

      console.error(
        'ERROR GENERANDO ETIQUETA:',
        error
      );


      if (
        !res.headersSent
      ) {

        return res.status(500).json({
          ok: false,

          error:
            error.message
        });

      }


      res.end();
    }
  }
);

// =======================================
// FINALIZAR CONVERSACIÓN POR INACTIVIDAD
// PROTEGIDO CONTRA RESPUESTAS RECIENTES
// =======================================

app.post(
  '/api/n8n/clientes/finalizar-inactividad',

  requiereApiN8n,

  async (req, res) => {

    try {

      // =====================================
      // TELÉFONO
      // =====================================

      let telefono = String(
        req.body.telefono || ''
      ).replace(/\D/g, '');


      if (telefono.length === 9) {

        telefono =
          '51' + telefono;

      }


      if (
        !/^51\d{9}$/.test(
          telefono
        )
      ) {

        return res.status(400).json({
          ok: false,
          error:
            'El teléfono es inválido.'
        });

      }


      // =====================================
      // MOMENTO EN QUE COMENZÓ
      // ESTE TEMPORIZADOR
      // =====================================

      const inicioRecordatorioMs =
        Number(
          req.body
            .inicio_recordatorio_ms ||
          0
        );


      if (
        !Number.isFinite(
          inicioRecordatorioMs
        ) ||
        inicioRecordatorioMs <= 0
      ) {

        return res.status(400).json({
          ok: false,
          archivado: false,
          error:
            'inicio_recordatorio_ms es obligatorio.'
        });

      }


      // =====================================
      // CONSULTAR ESTADO ACTUAL
      // =====================================

      const [clientes] =
        await db.query(
          `
          SELECT

            id,
            telefono,

            modo_atencion,

            asesor_id,
            asesor_nombre,

            ultima_interaccion_cliente,

            UNIX_TIMESTAMP(
              ultima_interaccion_cliente
            ) * 1000
              AS ultima_interaccion_cliente_ms

          FROM clientes

          WHERE telefono = ?

          LIMIT 1
          `,
          [
            telefono
          ]
        );


      if (!clientes.length) {

        return res.status(404).json({
          ok: false,
          archivado: false,
          error:
            'Cliente no encontrado.'
        });

      }


      const cliente =
        clientes[0];


      // =====================================
      // PROTECCIÓN 1
      // SI ESTÁ CON ASESOR
      // NO ARCHIVAR
      // =====================================

      if (
        String(
          cliente.modo_atencion ||
          ''
        )
          .trim()
          .toLowerCase() ===
        'asesor'
      ) {

        return res.json({

          ok: true,

          archivado: false,

          motivo:
            'asesor_activo'

        });

      }


      // =====================================
      // PROTECCIÓN 2
      //
      // VER SI EL CLIENTE ESCRIBIÓ
      // DESPUÉS DE HABER COMENZADO
      // ESTE TEMPORIZADOR
      // =====================================

      const ultimaInteraccionMs =
        Number(
          cliente
            .ultima_interaccion_cliente_ms ||
          0
        );


      if (
        ultimaInteraccionMs >
        inicioRecordatorioMs
      ) {

        console.log(
          'CIERRE CANCELADO - CLIENTE RESPONDIÓ:',
          {
            telefono,
            inicioRecordatorioMs,
            ultimaInteraccionMs
          }
        );


        return res.json({

          ok: true,

          archivado: false,

          motivo:
            'cliente_respondio',

          ultima_interaccion_cliente:
            cliente
              .ultima_interaccion_cliente

        });

      }


      // =====================================
      // ARCHIVAR
      // =====================================

      const [resultado] =
        await db.query(
          `
          UPDATE clientes

          SET

            archivado =
              1,

            fecha_archivado =
              NOW(),

            modo_atencion =
              'bot',

            requiere_asesor =
              0,

            fecha_solicitud_asesor =
              NULL,

            estado_conversacion =
              'nuevo',

            no_leidos =
              0,

            fecha_actualizacion =
              NOW()

          WHERE id = ?

            AND modo_atencion <> 'asesor'

            AND (
              ultima_interaccion_cliente
                IS NULL

              OR

              UNIX_TIMESTAMP(
                ultima_interaccion_cliente
              ) * 1000
                <= ?
            )
          `,
          [
            cliente.id,
            inicioRecordatorioMs
          ]
        );


      // =====================================
      // PROTECCIÓN 3
      //
      // SI RESPONDIÓ ENTRE EL SELECT
      // Y EL UPDATE, EL UPDATE NO TOCARÁ
      // NINGUNA FILA
      // =====================================

      if (
        resultado.affectedRows === 0
      ) {

        return res.json({

          ok: true,

          archivado: false,

          motivo:
            'actividad_detectada_antes_del_cierre'

        });

      }


      console.log(
        'CONVERSACIÓN ARCHIVADA POR INACTIVIDAD:',
        telefono
      );


      return res.json({

        ok: true,

        archivado: true,

        cliente_id:
          cliente.id,

        telefono

      });


    } catch (error) {

      console.error(
        'ERROR FINALIZANDO POR INACTIVIDAD:',
        error
      );


      return res.status(500).json({

        ok: false,

        archivado: false,

        error:
          'No se pudo finalizar la conversación por inactividad.'

      });

    }

  }
);

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.listen(PORT, () => {
  console.log(`CRM WhatsApp activo en http://localhost:${PORT}`);
});

