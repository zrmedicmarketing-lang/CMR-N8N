 

let clientes = [];
let clienteActual = null;
let usuarioLogueado = null;
let permisosUsuarioActual = {};
let perfilPermisosActual = 'personalizado';
let clienteMensajesRenderizado = null;
let filtroActual = 'todos';
let estadoClientesAnterior = new Map();
const estadoMensajesPorCliente = new Map();

// =======================================
// FUNCIONES GENERALES DE PERMISOS
// =======================================

function normalizarPermisosFrontend(permisos) {
  if (!permisos) {
    return {};
  }

  if (typeof permisos === 'object') {
    return permisos;
  }

  try {
    return JSON.parse(permisos);
  } catch (error) {
    console.error(
      'No se pudieron interpretar los permisos:',
      error
    );

    return {};
  }
}

function obtenerNivelPermiso(modulo, accion) {
  const rol = String(
    usuarioLogueado?.rol || ''
  )
    .trim()
    .toLowerCase();

  if (rol === 'admin') {
    return 'permitido';
  }

  return (
    permisosUsuarioActual?.[modulo]?.[accion] ||
    'denegado'
  );
}

function tienePermiso(modulo, accion) {
  const nivel = obtenerNivelPermiso(
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

function ocultarElementoPorPermiso(
  elemento,
  modulo,
  accion
) {
  if (!elemento) {
    return;
  }

  elemento.style.display =
    tienePermiso(modulo, accion)
      ? ''
      : 'none';
}

function bloquearElementoPorPermiso(
  elemento,
  modulo,
  accion
) {
  if (!elemento) {
    return;
  }

  const permitido =
    tienePermiso(modulo, accion);

  elemento.disabled = !permitido;

  elemento.classList.toggle(
    'sin-permiso',
    !permitido
  );
}

async function cargarPermisosUsuarioActual() {
  try {
    const res = await fetch(
      '/api/permisos/mios'
    );

    const contentType =
      res.headers.get('content-type') || '';

    if (
      !contentType.includes(
        'application/json'
      )
    ) {
      throw new Error(
        `La ruta de permisos respondió incorrectamente. Estado: ${res.status}`
      );
    }

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        'No se pudieron cargar los permisos.'
      );
    }

    permisosUsuarioActual =
      normalizarPermisosFrontend(
        data.permisos
      );

    perfilPermisosActual =
      data.perfil_permisos ||
      'personalizado';

    if (usuarioLogueado) {
      usuarioLogueado.permisos =
        permisosUsuarioActual;

      usuarioLogueado.perfil_permisos =
        perfilPermisosActual;
    }

    return permisosUsuarioActual;

  } catch (error) {
    console.error(
      'ERROR CARGANDO PERMISOS:',
      error
    );

    permisosUsuarioActual = {};
    perfilPermisosActual =
      'personalizado';

    return {};
  }
}

let notificacionesActivadas = false;

const preferenciaNotificaciones =
  localStorage.getItem('notificaciones_crm');

if (
  preferenciaNotificaciones === '1' &&
  'Notification' in window &&
  Notification.permission === 'granted'
) {
  notificacionesActivadas = true;
}
let temporizadorBusqueda = null;
let buscandoClientes = false;
const clientesDiv = document.getElementById('clientes');
const mensajesDiv = document.getElementById('mensajes');
const buscarInput = document.getElementById('buscar');
const clienteNombre = document.getElementById('clienteNombre');
// =======================================
// PERFIL CLIENTE
// =======================================

const abrirPerfilCliente =
  document.getElementById(
    'abrirPerfilCliente'
  );

const panelPerfilCliente =
  document.getElementById(
    'panelPerfilCliente'
  );

const fondoPerfilCliente =
  document.getElementById(
    'fondoPerfilCliente'
  );

const cerrarPerfilCliente =
  document.getElementById(
    'cerrarPerfilCliente'
  );

const formPerfilCliente =
  document.getElementById(
    'formPerfilCliente'
  );

const perfilNombre =
  document.getElementById(
    'perfilNombre'
  );

const perfilDocumentoTipo =
  document.getElementById(
    'perfilDocumentoTipo'
  );

const perfilDocumentoNumero =
  document.getElementById(
    'perfilDocumentoNumero'
  );

const perfilTelefono =
  document.getElementById(
    'perfilTelefono'
  );

const perfilCorreo =
  document.getElementById(
    'perfilCorreo'
  );

const perfilAsesor =
  document.getElementById(
    'perfilAsesor'
  );

const perfilFechaIngreso =
  document.getElementById(
    'perfilFechaIngreso'
  );

const perfilTipoComprobante =
  document.getElementById(
    'perfilTipoComprobante'
  );

const perfilFacturacionNombre =
  document.getElementById(
    'perfilFacturacionNombre'
  );

const perfilFacturacionDocumentoTipo =
  document.getElementById(
    'perfilFacturacionDocumentoTipo'
  );

const perfilFacturacionDocumentoNumero =
  document.getElementById(
    'perfilFacturacionDocumentoNumero'
  );

const perfilDireccion =
  document.getElementById(
    'perfilDireccion'
  );

const perfilDepartamento =
  document.getElementById(
    'perfilDepartamento'
  );

const perfilProvincia =
  document.getElementById(
    'perfilProvincia'
  );

const perfilDistrito =
  document.getElementById(
    'perfilDistrito'
  );

const perfilAgencia =
  document.getElementById(
    'perfilAgencia'
  );

const perfilSede =
  document.getElementById(
    'perfilSede'
  );
const clienteTelefono = document.getElementById('clienteTelefono');
const estadoSelect = document.getElementById('estado');
const formEnviar = document.getElementById('formEnviar');
const textoMensaje = document.getElementById('textoMensaje');

const btnEnviar = formEnviar.querySelector('button[type="submit"]');
const btnAdjuntar = document.getElementById('btnAdjuntar');
const archivoMensaje = document.getElementById('archivoMensaje');
// =======================================
// PREVIEW DE ARCHIVOS
// =======================================

const modalPreviewArchivo =
  document.getElementById(
    'modalPreviewArchivo'
  );


const previewArchivoContenido =
  document.getElementById(
    'previewArchivoContenido'
  );


const previewArchivoNombre =
  document.getElementById(
    'previewArchivoNombre'
  );


const previewArchivoNombreInfo =
  document.getElementById(
    'previewArchivoNombreInfo'
  );


const previewArchivoTamano =
  document.getElementById(
    'previewArchivoTamano'
  );


const previewArchivoIcono =
  document.getElementById(
    'previewArchivoIcono'
  );


const mensajeArchivoPreview =
  document.getElementById(
    'mensajeArchivoPreview'
  );


const cerrarPreviewArchivo =
  document.getElementById(
    'cerrarPreviewArchivo'
  );


const cancelarPreviewArchivo =
  document.getElementById(
    'cancelarPreviewArchivo'
  );


const enviarPreviewArchivo =
  document.getElementById(
    'enviarPreviewArchivo'
  );


let archivoPendienteEnvio =
  null;


let urlPreviewArchivo =
  '';
const btnTomar = document.getElementById('btnTomar');
const btnFinalizar = document.getElementById('btnFinalizar');
const btnBot = document.getElementById('btnBot');
const modoAtencion = document.getElementById('modoAtencion');
const asesorSelect = document.getElementById('asesorSelect');
const filtros = document.querySelectorAll('.filtros-crm button');
const btnFiltroAsesor =
  document.querySelector(
    '[data-filtro="requiere_asesor"]'
  );
const btnEmoji = document.getElementById("btnEmoji");
const emojiContainer = document.getElementById("emojiPickerContainer");
const btnVoz = document.getElementById('btnVoz');
const btnRapidas = document.getElementById('btnRapidas');
const panelRespuestasRapidas = document.getElementById('panelRespuestasRapidas');
const menuFormato = document.getElementById('menuFormato');
const btnNuevoUsuario = document.getElementById('btnNuevoUsuario');
const modalUsuario = document.getElementById('modalUsuario');
const cerrarModalUsuario = document.getElementById('cerrarModalUsuario');
const formUsuario = document.getElementById('formUsuario');

const nuevoRol = document.getElementById('nuevoRol');
const configAsignacionNuevo = document.getElementById('configAsignacionNuevo');
const btnModuloPagos =
  document.getElementById('btnModuloPagos');

 

const btnActualizarPagos =
  document.getElementById('btnActualizarPagos');

const listaPagosPendientes =
  document.getElementById('listaPagosPendientes');

const contadorPagosPendientes =
  document.getElementById(
    'contadorPagosPendientes'
  );
// =======================================
// CAJA Y FACTURACIÓN
// =======================================

const btnVistaCaja =
  document.getElementById(
    'btnVistaCaja'
  );

const vistaCaja =
  document.getElementById(
    'vistaCaja'
  );

const btnActualizarPedidos =
  document.getElementById(
    'btnActualizarPedidos'
  );

const listaPedidosFacturacion =
  document.getElementById(
    'listaPedidosFacturacion'
  );

 

const statPagosPendientes =
  document.getElementById(
    'statPagosPendientes'
  );

const statPedidosFacturacion =
  document.getElementById(
    'statPedidosFacturacion'
  );

const statListosDespacho =
  document.getElementById(
    'statListosDespacho'
  );

const tabCajaPagos =
  document.getElementById(
    'tabCajaPagos'
  );

const tabCajaPedidos =
  document.getElementById(
    'tabCajaPedidos'
  );

const panelCajaPagos =
  document.getElementById(
    'panelCajaPagos'
  );

const panelCajaPedidos =
  document.getElementById(
    'panelCajaPedidos'
  );

const buscarPedidoCaja =
  document.getElementById(
    'buscarPedidoCaja'
  );

// =======================================
// FILTROS PENDIENTES / FACTURADOS
// =======================================

const btnPedidosPendientes =
    document.getElementById(
        'btnPedidosPendientes'
    );

const btnPedidosFacturados =
    document.getElementById(
        'btnPedidosFacturados'
    );

const contadorPedidosPendientes =
    document.getElementById(
        'contadorPedidosPendientes'
    );

const contadorPedidosFacturados =
    document.getElementById(
        'contadorPedidosFacturados'
    );
const resumenEmbudo =
  document.getElementById('resumenEmbudo');

const filtroAsesorEmbudo =
  document.getElementById('filtroAsesorEmbudo');

const btnNuevoLead =
  document.getElementById('btnNuevoLead');

const filtrosEmbudo =
  document.querySelectorAll(
    '[data-filtro-embudo]'
  );

const btnVistaSeguimientos =
  document.getElementById(
    'btnVistaSeguimientos'
  );

const vistaSeguimientos =
  document.getElementById(
    'vistaSeguimientos'
  );

const btnActualizarSeguimientos =
  document.getElementById(
    'btnActualizarSeguimientos'
  );

const btnNuevoSeguimiento =
  document.getElementById(
    'btnNuevoSeguimiento'
  );

const listaSeguimientos =
  document.getElementById(
    'listaSeguimientos'
  );

const modalSeguimiento =
  document.getElementById(
    'modalSeguimiento'
  );

const formSeguimiento =
  document.getElementById(
    'formSeguimiento'
  );

const cerrarModalSeguimiento =
  document.getElementById(
    'cerrarModalSeguimiento'
  );

const seguimientoClienteId =
  document.getElementById(
    'seguimientoClienteId'
  );

const seguimientoClienteNombre =
  document.getElementById(
    'seguimientoClienteNombre'
  );

const seguimientoTitulo =
  document.getElementById(
    'seguimientoTitulo'
  );

const seguimientoFecha =
  document.getElementById(
    'seguimientoFecha'
  );

const seguimientoPrioridad =
  document.getElementById(
    'seguimientoPrioridad'
  );

const seguimientoAsesor =
  document.getElementById(
    'seguimientoAsesor'
  );

const seguimientoNota =
  document.getElementById(
    'seguimientoNota'
  );

let filtroEmbudoActual = 'activos';
let seguimientosComerciales = [];
 

const btnConfiguracion =
  document.getElementById('btnConfiguracion');

const panelAjustes =
  document.getElementById('panelAjustes');

const cerrarPanelAjustes =
  document.getElementById('cerrarPanelAjustes');

const fondoPanelAjustes =
  document.getElementById('fondoPanelAjustes');

const estadoNotificacionesAjustes =
  document.getElementById(
    'estadoNotificacionesAjustes'
  );
let usuariosRegistrados = [];
let mediaRecorder = null;
let audioChunks = [];
let grabandoVoz = false;
// ===============================
// PICKER DE EMOJIS
// ===============================

const picker = document.createElement("emoji-picker");

emojiContainer.appendChild(picker);

picker.addEventListener("emoji-click", (e) => {

    textoMensaje.value += e.detail.unicode;

    textoMensaje.focus();

});

btnEmoji.addEventListener("click", (e) => {

    e.stopPropagation();

    emojiContainer.classList.toggle("mostrar");

});

btnRapidas.addEventListener('click', (e) => {
  e.stopPropagation();
  panelRespuestasRapidas.classList.toggle('mostrar');
});
const listaRespuestasRapidas = document.getElementById('listaRespuestasRapidas');
const btnEditarRapidas = document.getElementById('btnEditarRapidas');
const modalRapidas = document.getElementById('modalRapidas');
const editorRapidas = document.getElementById('editorRapidas');
const btnAgregarRapida = document.getElementById('btnAgregarRapida');
const cerrarModalRapidas = document.getElementById('cerrarModalRapidas');

let respuestasRapidas = [];
let imagenRapidaSeleccionada =
  '';

const previewImagenRapida =
  document.getElementById(
    'previewImagenRapida'
  );

const previewImagenRapidaImg =
  document.getElementById(
    'previewImagenRapidaImg'
  );

const quitarImagenRapida =
  document.getElementById(
    'quitarImagenRapida'
  );

function seleccionarImagenRapida(
  imagenUrl
) {

  imagenRapidaSeleccionada =
    String(
      imagenUrl || ''
    ).trim();


  if (
    !imagenRapidaSeleccionada
  ) {

    if (previewImagenRapida) {
      previewImagenRapida.style.display =
        'none';
    }

    if (previewImagenRapidaImg) {
      previewImagenRapidaImg.src =
        '';
    }

    return;
  }


  if (previewImagenRapidaImg) {

    previewImagenRapidaImg.src =
      imagenRapidaSeleccionada;

  }


  if (previewImagenRapida) {

    previewImagenRapida.style.display =
      'flex';

  }

}


quitarImagenRapida?.addEventListener(
  'click',
  () => {

    seleccionarImagenRapida(
      ''
    );

  }
);
async function cargarRespuestasRapidas() {
  const res = await fetch('/api/respuestas-rapidas');
  respuestasRapidas = await res.json();

  pintarRespuestasRapidas();
}

// =======================================
// ATAJOS DE RESPUESTAS RÁPIDAS
// /1, /2, /g, /precio, etc.
// =======================================

function normalizarAtajoRapida(
  valor
) {

  const limpio =
    String(
      valor || ''
    )
      .trim()
      .toLowerCase()
      .replace(/^\/+/, '');

  if (!limpio) {
    return '';
  }

  return '/' + limpio;
}


// =======================================
// APLICAR RESPUESTA RÁPIDA
// =======================================

function aplicarRespuestaRapida(
  respuesta
) {

  if (!respuesta) {
    return;
  }


  // Cargar texto
  textoMensaje.value =
    respuesta.texto || '';


  // Cargar imagen si ya implementaste
  // respuestas rápidas con imagen
  if (
    typeof seleccionarImagenRapida ===
      'function'
  ) {

    seleccionarImagenRapida(
      respuesta.imagen_url || ''
    );

  }


  // Cerrar panel
  panelRespuestasRapidas
    ?.classList
    .remove(
      'mostrar'
    );


  // Mantener foco
  textoMensaje.focus();


  // Cursor al final
  const posicion =
    textoMensaje.value.length;

  textoMensaje.setSelectionRange(
    posicion,
    posicion
  );
}


// =======================================
// DETECTAR ATAJO MIENTRAS ESCRIBE
// =======================================

textoMensaje.addEventListener(
  'input',
  () => {

    const escrito =
      String(
        textoMensaje.value || ''
      )
        .trim()
        .toLowerCase();


    // Solo trabajar cuando empieza con /
    if (
      !escrito.startsWith('/')
    ) {
      return;
    }


    // ===================================
    // BUSCAR COINCIDENCIA EXACTA
    // ===================================

    const respuestaExacta =
      respuestasRapidas.find(
        respuesta => {

          const atajo =
            normalizarAtajoRapida(
              respuesta.atajo
            );

          return (
            atajo === escrito
          );

        }
      );


    // ===================================
    // SI EXISTE /1, /2, /g...
    // ===================================

    if (respuestaExacta) {

      aplicarRespuestaRapida(
        respuestaExacta
      );

      return;
    }


    // ===================================
    // MOSTRAR PANEL AL ESCRIBIR /
    // ===================================

    const coincidencias =
      respuestasRapidas.filter(
        respuesta => {

          const atajo =
            normalizarAtajoRapida(
              respuesta.atajo
            );

          return (
            atajo &&
            atajo.startsWith(
              escrito
            )
          );

        }
      );


    if (
      coincidencias.length > 0
    ) {

      pintarRespuestasRapidas(
        escrito
      );

      panelRespuestasRapidas
        ?.classList
        .add(
          'mostrar'
        );

    }

  }
);


function pintarRespuestasRapidas(
  filtro = ''
) {

  listaRespuestasRapidas.innerHTML =
    '';


  const filtroNormalizado =
    String(
      filtro || ''
    )
      .trim()
      .toLowerCase();


  const lista =
    respuestasRapidas.filter(
      respuesta => {

        if (!filtroNormalizado) {
          return true;
        }


        const atajo =
          normalizarAtajoRapida(
            respuesta.atajo
          );


        const titulo =
          String(
            respuesta.titulo || ''
          )
            .trim()
            .toLowerCase();


        return (
          atajo.startsWith(
            filtroNormalizado
          ) ||
          titulo.includes(
            filtroNormalizado
              .replace(
                /^\//,
                ''
              )
          )
        );

      }
    );


  lista.forEach(
    r => {

      const btn =
        document.createElement(
          'button'
        );


      btn.type =
        'button';


      const atajoVisual =
        normalizarAtajoRapida(
          r.atajo
        );


      btn.innerHTML = `

        ${
          atajoVisual
            ? `
              <span class="atajo-rapida">
                ${escapeHtml(
                  atajoVisual
                )}
              </span>
            `
            : ''
        }


        ${
          r.imagen_url
            ? `
              <i
                class="fa-solid fa-image"
                style="
                  margin-right:6px;
                  color:#0b8f82;
                "
                title="Incluye imagen"
              ></i>
            `
            : ''
        }


        <span>
          ${escapeHtml(
            r.titulo
          )}
        </span>

      `;


      btn.addEventListener(
        'click',
        () => {

          aplicarRespuestaRapida(
            r
          );

        }
      );


      listaRespuestasRapidas
        .appendChild(
          btn
        );

    }
  );
}

btnEditarRapidas.addEventListener('click', (e) => {
  e.stopPropagation();
  abrirEditorRapidas();
});

function abrirEditorRapidas() {
  editorRapidas.innerHTML = '';

  respuestasRapidas.forEach(r => {
    const item = document.createElement('div');
    item.className = 'item-rapida';
item.innerHTML = `

  <label class="campo-rapida">
    <span>Título</span>

    <input
      type="text"
      class="titulo-rapida-input"
      value="${escapeHtml(r.titulo || '')}"
      placeholder="Ejemplo: Saludo"
    >
  </label>


  <label class="campo-rapida">
    <span>Atajo</span>

    <div class="atajo-editor-contenedor">

      <span class="atajo-prefijo">
        /
      </span>

      <input
        type="text"
        class="atajo-rapida-input"
        value="${escapeHtml(
          String(r.atajo || '')
           .replace(/^\/+/, '')
        )}"
        placeholder="1"
        maxlength="20"
        autocomplete="off"
      >

    </div>

    <small class="ayuda-atajo">
      Ejemplo: escribe 1 y el atajo será /1
    </small>
  </label>


  <div class="toolbar-rapidas">
    <button type="button" class="emoji-rapida">😊</button>
    <button type="button" class="fmt-rapida" data-format="bold"><b>B</b></button>
    <button type="button" class="fmt-rapida" data-format="italic"><i>I</i></button>
    <button type="button" class="fmt-rapida" data-format="strike"><s>S</s></button>
    <button type="button" class="fmt-rapida" data-format="code">&lt;/&gt;</button>
  </div>

  <textarea placeholder="Mensaje">${escapeHtml(r.texto)}</textarea>
<div class="rapida-imagen-editor">

  <div class="rapida-imagen-controles">

    <button
      type="button"
      class="btn-imagen-rapida"
    >
      <i class="fa-solid fa-image"></i>

      ${
        r.imagen_url
          ? 'Cambiar imagen'
          : 'Agregar imagen'
      }
    </button>


    <input
      type="file"
      class="input-imagen-rapida"
      accept="image/jpeg,image/png,image/webp"
      hidden
    >


    ${
      r.imagen_url
        ? `
          <button
            type="button"
            class="quitar-imagen-rapida"
          >
            <i class="fa-solid fa-trash"></i>
            Quitar imagen
          </button>
        `
        : ''
    }

  </div>


  ${
    r.imagen_url
      ? `
        <img
          class="preview-imagen-editor"
          src="${escapeHtml(
            r.imagen_url
          )}"
          alt="Imagen de respuesta rápida"
        >
      `
      : ''
  }

</div>
  <div class="acciones-form">
    <button type="button" class="guardar">Guardar</button>
    <button type="button" class="eliminar">Eliminar</button>
  </div>
`;

const inputTitulo =
  item.querySelector(
    '.titulo-rapida-input'
  );

const inputAtajo =
  item.querySelector(
    '.atajo-rapida-input'
  );

 

   const btnImagenRapida =
  item.querySelector(
    '.btn-imagen-rapida'
  );
const inputTexto =
  item.querySelector(
    'textarea'
  );
const inputImagenRapida =
  item.querySelector(
    '.input-imagen-rapida'
  );

const btnQuitarImagen =
  item.querySelector(
    '.quitar-imagen-rapida'
  );
btnImagenRapida?.addEventListener(
  'click',
  () => {

    inputImagenRapida?.click();

  }
);


inputImagenRapida?.addEventListener(
  'change',
  async () => {

    const archivo =
      inputImagenRapida
        .files?.[0];


    if (!archivo) {
      return;
    }


    if (
      !archivo.type.startsWith(
        'image/'
      )
    ) {

      alert(
        'Selecciona una imagen válida.'
      );

      return;
    }


    const formData =
      new FormData();


    formData.append(
      'imagen',
      archivo
    );


    btnImagenRapida.disabled =
      true;


    btnImagenRapida.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';


    try {

      const res =
        await fetch(
          `/api/respuestas-rapidas/${r.id}/imagen`,
          {
            method: 'POST',
            body: formData
          }
        );


      const data =
        await res.json();


      if (
        !res.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ||
          'No se pudo guardar la imagen.'
        );

      }


      await cargarRespuestasRapidas();

      abrirEditorRapidas();


    } catch (error) {

      console.error(
        'ERROR SUBIENDO IMAGEN:',
        error
      );


      alert(
        error.message
      );

    }

  }
);
btnQuitarImagen?.addEventListener(
  'click',
  async () => {

    if (
      !confirm(
        '¿Quitar la imagen de esta respuesta rápida?'
      )
    ) {
      return;
    }


    try {

      const res =
        await fetch(
          `/api/respuestas-rapidas/${r.id}/imagen`,
          {
            method:
              'DELETE'
          }
        );


      const data =
        await res.json();


      if (
        !res.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ||
          'No se pudo quitar la imagen.'
        );

      }


      await cargarRespuestasRapidas();

      abrirEditorRapidas();


    } catch (error) {

      alert(
        error.message
      );

    }

  }
);

   item.querySelectorAll('.fmt-rapida').forEach(btn => {
  btn.addEventListener('click', () => {
    aplicarFormatoEnTextarea(inputTexto, btn.dataset.format);
  });
});

const emojiBtn = item.querySelector('.emoji-rapida');

const emojiPopup = document.createElement('div');
emojiPopup.className = 'emoji-popup';

const pickerRapida = document.createElement('emoji-picker');
emojiPopup.appendChild(pickerRapida);

item.querySelector('.toolbar-rapidas').appendChild(emojiPopup);

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPopup.classList.toggle('mostrar');
});

pickerRapida.addEventListener('emoji-click', (e) => {
  const inicio = inputTexto.selectionStart;
  const fin = inputTexto.selectionEnd;

  inputTexto.setRangeText(
    e.detail.unicode,
    inicio,
    fin,
    'end'
  );

  inputTexto.focus();
  emojiPopup.classList.remove('mostrar');
});

    item.querySelector('.guardar').addEventListener('click', async () => {
      await fetch(`/api/respuestas-rapidas/${r.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({

  titulo:
    inputTitulo.value.trim(),

  atajo:
    inputAtajo.value
      .trim()
      .replace(/^\/+/, ''),

  texto:
    inputTexto.value

})
      });

      await cargarRespuestasRapidas();
      abrirEditorRapidas();
    });

    item.querySelector('.eliminar').addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta respuesta rápida?')) return;

      await fetch(`/api/respuestas-rapidas/${r.id}`, {
        method: 'DELETE'
      });

      await cargarRespuestasRapidas();
      abrirEditorRapidas();
    });

    editorRapidas.appendChild(item);
  });

  modalRapidas.classList.add('mostrar');
}
function aplicarFormatoEnTextarea(textarea, formato) {
  const inicio = textarea.selectionStart;
  const fin = textarea.selectionEnd;
  const texto = textarea.value;
  const seleccionado = texto.substring(inicio, fin) || '';

  let antes = '';
  let despues = '';

  if (formato === 'bold') {
    antes = '*';
    despues = '*';
  }

  if (formato === 'italic') {
    antes = '_';
    despues = '_';
  }

  if (formato === 'strike') {
    antes = '~';
    despues = '~';
  }

  if (formato === 'code') {
    antes = '```';
    despues = '```';
  }

  textarea.value =
    texto.substring(0, inicio) +
    antes +
    seleccionado +
    despues +
    texto.substring(fin);

  textarea.focus();
  textarea.selectionStart = inicio + antes.length;
  textarea.selectionEnd = fin + antes.length + seleccionado.length;
}
btnAgregarRapida.addEventListener('click', async () => {
  await fetch('/api/respuestas-rapidas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: 'Nueva respuesta',
      texto: 'Escribe aquí el mensaje'
    })
  });

  await cargarRespuestasRapidas();
  abrirEditorRapidas();
});

cerrarModalRapidas.addEventListener('click', () => {
  modalRapidas.classList.remove('mostrar');
});

document.addEventListener('click', (e) => {
  if (
    !panelRespuestasRapidas.contains(e.target) &&
    !btnRapidas.contains(e.target)
  ) {
    panelRespuestasRapidas.classList.remove('mostrar');
  }
});

document.addEventListener("click", (e) => {

    if (
        !emojiContainer.contains(e.target) &&
        !btnEmoji.contains(e.target)
    ) {
        emojiContainer.classList.remove("mostrar");
    }

});

// ===============================
// FORMATO FLOTANTE TIPO WHATSAPP
// ===============================

textoMensaje.addEventListener('mouseup', mostrarMenuFormato);
textoMensaje.addEventListener('keyup', mostrarMenuFormato);

function mostrarMenuFormato() {
  const inicio = textoMensaje.selectionStart;
  const fin = textoMensaje.selectionEnd;

  if (inicio === fin) {
    menuFormato.classList.remove('mostrar');
    return;
  }

  const rect = textoMensaje.getBoundingClientRect();

  menuFormato.style.left = `${rect.left + 20}px`;
  menuFormato.style.top = `${rect.top - 48}px`;
  menuFormato.classList.add('mostrar');
}

menuFormato.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();

    const formato = btn.dataset.formato;
    aplicarFormatoTexto(formato);
  });
});

function aplicarFormatoTexto(formato) {
  const inicio = textoMensaje.selectionStart;
  const fin = textoMensaje.selectionEnd;

  if (inicio === fin) return;

  const texto = textoMensaje.value;
  const seleccionado = texto.substring(inicio, fin);

  let antes = '';
  let despues = '';

  if (formato === 'bold') {
    antes = '*';
    despues = '*';
  }

  if (formato === 'italic') {
    antes = '_';
    despues = '_';
  }

  if (formato === 'strike') {
    antes = '~';
    despues = '~';
  }

  if (formato === 'code') {
    antes = '```';
    despues = '```';
  }

  textoMensaje.value =
    texto.substring(0, inicio) +
    antes +
    seleccionado +
    despues +
    texto.substring(fin);

  textoMensaje.focus();

  textoMensaje.selectionStart = inicio + antes.length;
  textoMensaje.selectionEnd = fin + antes.length;

  menuFormato.classList.remove('mostrar');
}

document.addEventListener('click', (e) => {
  if (
    !menuFormato.contains(e.target) &&
    e.target !== textoMensaje
  ) {
    menuFormato.classList.remove('mostrar');
  }
});
// =======================================
// ENTER PARA ENVIAR
// SHIFT + ENTER = NUEVA LÍNEA
// =======================================

textoMensaje.addEventListener("keydown", (e) => {

    if (e.key === "Enter" && !e.shiftKey) {

        e.preventDefault();

        if (textoMensaje.value.trim() === "") return;

        if (btnEnviar.disabled) return;

        formEnviar.requestSubmit();

    }

});


// =======================================
// PREVIEW Y ENVÍO DE ARCHIVOS
// =======================================


// =======================================
// ABRIR SELECTOR DE ARCHIVOS
// =======================================

btnAdjuntar.addEventListener(
  'click',
  () => {

    if (!clienteActual) {

      alert(
        'Selecciona un chat primero.'
      );

      return;
    }


    if (btnAdjuntar.disabled) {
      return;
    }


    archivoMensaje.click();

  }
);


// =======================================
// FORMATEAR TAMAÑO DEL ARCHIVO
// =======================================

function formatearTamanoArchivo(
  bytes
) {

  const numero =
    Number(bytes || 0);


  if (numero < 1024) {

    return `${numero} B`;

  }


  if (
    numero <
    1024 * 1024
  ) {

    return (
      numero / 1024
    ).toFixed(1) + ' KB';

  }


  return (
    numero /
    (
      1024 *
      1024
    )
  ).toFixed(1) + ' MB';

}


// =======================================
// ICONO SEGÚN TIPO DE ARCHIVO
// =======================================

function obtenerClaseIconoPreview(
  archivo
) {

  const mime =
    String(
      archivo?.type || ''
    )
      .toLowerCase();


  const nombre =
    String(
      archivo?.name || ''
    )
      .toLowerCase();


  if (
    mime.startsWith(
      'image/'
    )
  ) {

    return 'fa-solid fa-image';

  }


  if (
    mime.startsWith(
      'video/'
    )
  ) {

    return 'fa-solid fa-video';

  }


  if (
    mime.startsWith(
      'audio/'
    )
  ) {

    return 'fa-solid fa-file-audio';

  }


  if (
    mime.includes('pdf') ||
    nombre.endsWith('.pdf')
  ) {

    return 'fa-solid fa-file-pdf';

  }


  if (
    nombre.endsWith('.doc') ||
    nombre.endsWith('.docx')
  ) {

    return 'fa-solid fa-file-word';

  }


  if (
    nombre.endsWith('.xls') ||
    nombre.endsWith('.xlsx')
  ) {

    return 'fa-solid fa-file-excel';

  }


  if (
    nombre.endsWith('.ppt') ||
    nombre.endsWith('.pptx')
  ) {

    return 'fa-solid fa-file-powerpoint';

  }


  return 'fa-solid fa-file';

}


// =======================================
// CERRAR / LIMPIAR PREVIEW
// =======================================

function limpiarPreviewArchivo() {

  if (urlPreviewArchivo) {

    URL.revokeObjectURL(
      urlPreviewArchivo
    );

  }


  urlPreviewArchivo =
    '';


  archivoPendienteEnvio =
    null;


  archivoMensaje.value =
    '';


  if (
    previewArchivoContenido
  ) {

    previewArchivoContenido.innerHTML =
      '';

  }


  if (
    mensajeArchivoPreview
  ) {

    mensajeArchivoPreview.value =
      '';

  }


  modalPreviewArchivo
    ?.classList
    .remove(
      'mostrar'
    );


  modalPreviewArchivo
    ?.setAttribute(
      'aria-hidden',
      'true'
    );

}


// =======================================
// MOSTRAR VISTA PREVIA
// =======================================

function mostrarPreviewArchivo(
  archivo
) {

  if (!archivo) {
    return;
  }


  archivoPendienteEnvio =
    archivo;


  if (
    urlPreviewArchivo
  ) {

    URL.revokeObjectURL(
      urlPreviewArchivo
    );

  }


  urlPreviewArchivo =
    URL.createObjectURL(
      archivo
    );


  const mime =
    String(
      archivo.type || ''
    )
      .toLowerCase();


  const nombre =
    String(
      archivo.name ||
      'Archivo'
    );


  // =====================================
  // NOMBRE
  // =====================================

  if (
    previewArchivoNombre
  ) {

    previewArchivoNombre.textContent =
      nombre;

  }


  if (
    previewArchivoNombreInfo
  ) {

    previewArchivoNombreInfo.textContent =
      nombre;

  }


  // =====================================
  // TAMAÑO
  // =====================================

  if (
    previewArchivoTamano
  ) {

    previewArchivoTamano.textContent =
      formatearTamanoArchivo(
        archivo.size
      );

  }


  // =====================================
  // ICONO
  // =====================================

  if (
    previewArchivoIcono
  ) {

    previewArchivoIcono.className =
      obtenerClaseIconoPreview(
        archivo
      );

  }


  // =====================================
  // IMAGEN
  // =====================================

  if (
    mime.startsWith(
      'image/'
    )
  ) {

    previewArchivoContenido.innerHTML = `
      <img
        src="${urlPreviewArchivo}"
        alt="Vista previa"
      >
    `;

  }


  // =====================================
  // VIDEO
  // =====================================

  else if (
    mime.startsWith(
      'video/'
    )
  ) {

    previewArchivoContenido.innerHTML = `
      <video
        src="${urlPreviewArchivo}"
        controls
        preload="metadata"
      ></video>
    `;

  }


  // =====================================
  // AUDIO
  // =====================================

  else if (
    mime.startsWith(
      'audio/'
    )
  ) {

    previewArchivoContenido.innerHTML = `
      <div
        class="preview-documento-generico"
      >

        <i
          class="fa-solid fa-file-audio"
        ></i>

        <strong>
          ${escapeHtml(
            nombre
          )}
        </strong>

        <audio
          src="${urlPreviewArchivo}"
          controls
          preload="metadata"
        ></audio>

      </div>
    `;

  }


  // =====================================
  // PDF
  // =====================================

  else if (
    mime.includes('pdf') ||
    nombre
      .toLowerCase()
      .endsWith('.pdf')
  ) {

    previewArchivoContenido.innerHTML = `
      <iframe
        class="preview-pdf"
        src="${urlPreviewArchivo}"
        title="Vista previa PDF"
      ></iframe>
    `;

  }


  // =====================================
  // WORD / EXCEL / OTROS
  // =====================================

  else {

    const icono =
      obtenerClaseIconoPreview(
        archivo
      );


    previewArchivoContenido.innerHTML = `
      <div
        class="preview-documento-generico"
      >

        <i
          class="${icono}"
        ></i>

        <strong>
          ${escapeHtml(
            nombre
          )}
        </strong>

        <span>
          Vista previa no disponible
          para este tipo de archivo.
        </span>

      </div>
    `;

  }


  // =====================================
  // COPIAR TEXTO QUE YA ESCRIBIÓ
  // =====================================

  if (
    mensajeArchivoPreview
  ) {

    mensajeArchivoPreview.value =
      textoMensaje.value || '';

  }


  // =====================================
  // ABRIR MODAL
  // =====================================

  modalPreviewArchivo
    ?.classList
    .add(
      'mostrar'
    );


  modalPreviewArchivo
    ?.setAttribute(
      'aria-hidden',
      'false'
    );


  setTimeout(
    () => {

      mensajeArchivoPreview
        ?.focus();

    },
    50
  );

}


// =======================================
// AL SELECCIONAR ARCHIVO
// SOLO MOSTRAR PREVIEW
// =======================================

archivoMensaje.addEventListener(
  'change',
  () => {

    if (!clienteActual) {

      archivoMensaje.value =
        '';

      return;
    }


    const archivo =
      archivoMensaje
        .files?.[0];


    if (!archivo) {
      return;
    }


    mostrarPreviewArchivo(
      archivo
    );

  }
);


// =======================================
// CANCELAR / CERRAR
// =======================================

cerrarPreviewArchivo
  ?.addEventListener(
    'click',
    limpiarPreviewArchivo
  );


cancelarPreviewArchivo
  ?.addEventListener(
    'click',
    limpiarPreviewArchivo
  );


// =======================================
// CLIC FUERA DEL MODAL
// =======================================

modalPreviewArchivo
  ?.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        modalPreviewArchivo
      ) {

        limpiarPreviewArchivo();

      }

    }
  );


// =======================================
// ESCAPE PARA CERRAR
// =======================================

document.addEventListener(
  'keydown',
  event => {

    if (
      event.key === 'Escape' &&
      modalPreviewArchivo
        ?.classList
        .contains(
          'mostrar'
        )
    ) {

      limpiarPreviewArchivo();

    }

  }
);


// =======================================
// ENTER EN EL MENSAJE DEL ARCHIVO
// CTRL + ENTER = ENVIAR
// =======================================

mensajeArchivoPreview
  ?.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Enter' &&
        event.ctrlKey
      ) {

        event.preventDefault();

        enviarPreviewArchivo
          ?.click();

      }

    }
  );


// =======================================
// ENVIAR ARCHIVO DESPUÉS DE CONFIRMAR
// =======================================

enviarPreviewArchivo
  ?.addEventListener(
    'click',
    async () => {

      if (
        !clienteActual ||
        !archivoPendienteEnvio
      ) {

        return;

      }


      const archivo =
        archivoPendienteEnvio;


      const mensaje =
        String(
          mensajeArchivoPreview
            ?.value || ''
        )
          .trim();


      const textoBoton =
        enviarPreviewArchivo
          .innerHTML;


      enviarPreviewArchivo.disabled =
        true;


      cerrarPreviewArchivo.disabled =
        true;


      cancelarPreviewArchivo.disabled =
        true;


      enviarPreviewArchivo.innerHTML = `
        <i
          class="fa-solid fa-spinner fa-spin"
        ></i>
        Enviando...
      `;


      try {

        const formData =
          new FormData();


        formData.append(
          'cliente_id',
          clienteActual.id
        );


        formData.append(
          'telefono',
          clienteActual.telefono
        );


        formData.append(
          'mensaje',
          mensaje
        );


        formData.append(
          'archivo',
          archivo
        );


        const res =
          await fetch(
            '/api/enviar-media',
            {
              method:
                'POST',

              body:
                formData
            }
          );


        const data =
          await res.json();


        if (
          !res.ok ||
          !data.ok
        ) {

          // =================================
          // CHAT ASIGNADO A OTRO ASESOR
          // =================================

          if (
            data.bloqueado
          ) {

            alert(
              data.error
            );

            return;

          }


          throw new Error(
            data.error?.error?.message ||
            data.error?.message ||
            data.error ||
            'No se pudo enviar el archivo.'
          );

        }


        // =================================
        // LIMPIAR TEXTO DEL COMPOSER
        // =================================

        textoMensaje.value =
          '';


        // =================================
        // CERRAR PREVIEW
        // =================================

        limpiarPreviewArchivo();


        // =================================
        // ACTUALIZAR CHAT
        // =================================

        await cargarMensajes(
          clienteActual.id,
          true
        );


        await cargarClientes();


      } catch (error) {

        console.error(
          'ERROR ENVIANDO ARCHIVO:',
          error
        );


        alert(
          error.message ||
          'No se pudo enviar el archivo.'
        );


      } finally {

        enviarPreviewArchivo.disabled =
          false;


        cerrarPreviewArchivo.disabled =
          false;


        cancelarPreviewArchivo.disabled =
          false;


        enviarPreviewArchivo.innerHTML =
          textoBoton;

      }

    }
  );
// =======================================
// GRABADOR DE VOZ TIPO WHATSAPP
// =======================================

const grabadorVozPanel =
  document.getElementById(
    'grabadorVozPanel'
  );


const btnCancelarVoz =
  document.getElementById(
    'btnCancelarVoz'
  );


const btnDetenerVoz =
  document.getElementById(
    'btnDetenerVoz'
  );


const btnEnviarVoz =
  document.getElementById(
    'btnEnviarVoz'
  );


const vozTiempo =
  document.getElementById(
    'vozTiempo'
  );


const previewVozAudio =
  document.getElementById(
    'previewVozAudio'
  );


let streamVoz =
  null;


let archivoVozPendiente =
  null;


let urlVozPendiente =
  '';


let inicioGrabacionVoz =
  0;


let intervaloGrabacionVoz =
  null;


let cancelarGrabacionActual =
  false;


// =======================================
// FORMATEAR TIEMPO
// =======================================

function formatearTiempoVoz(
  segundos
) {

  const min =
    Math.floor(
      segundos / 60
    );


  const seg =
    segundos % 60;


  return (
    `${min}:${
      String(
        seg
      ).padStart(
        2,
        '0'
      )
    }`
  );

}


// =======================================
// ACTUALIZAR CRONÓMETRO
// =======================================

function iniciarCronometroVoz() {

  inicioGrabacionVoz =
    Date.now();


  vozTiempo.textContent =
    '0:00';


  clearInterval(
    intervaloGrabacionVoz
  );


  intervaloGrabacionVoz =
    setInterval(
      () => {

        const segundos =
          Math.floor(
            (
              Date.now() -
              inicioGrabacionVoz
            ) /
            1000
          );


        vozTiempo.textContent =
          formatearTiempoVoz(
            segundos
          );

      },
      250
    );

}


// =======================================
// DETENER STREAM DEL MICRO
// =======================================

function cerrarStreamVoz() {

  if (
    streamVoz
  ) {

    streamVoz
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  streamVoz =
    null;

}


// =======================================
// RESETEAR GRABADOR
// =======================================

function limpiarGrabadorVoz() {

  clearInterval(
    intervaloGrabacionVoz
  );


  intervaloGrabacionVoz =
    null;


  cerrarStreamVoz();


  if (
    urlVozPendiente
  ) {

    URL.revokeObjectURL(
      urlVozPendiente
    );

  }


  urlVozPendiente =
    '';


  archivoVozPendiente =
    null;


  cancelarGrabacionActual =
    false;


  if (
    previewVozAudio
  ) {

    previewVozAudio.pause();

    previewVozAudio.removeAttribute(
      'src'
    );

    previewVozAudio.load();

  }


  grabadorVozPanel
    ?.classList
    .remove(
      'preview'
    );


  formEnviar
    ?.classList
    .remove(
      'grabando-voz'
    );


  grabandoVoz =
    false;


  vozTiempo.textContent =
    '0:00';

}


// =======================================
// INICIAR GRABACIÓN
// =======================================

btnVoz.addEventListener(
  'click',
  async () => {

    if (
      !clienteActual
    ) {

      alert(
        'Selecciona un chat primero.'
      );

      return;

    }


    if (
      grabandoVoz
    ) {
      return;
    }


    try {

      cancelarGrabacionActual =
        false;


      streamVoz =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation:
                true,

              noiseSuppression:
                true,

              autoGainControl:
                true
            }
          });


      audioChunks =
        [];


      let tipoAudio =
        '';


      /*
       * Chrome / Edge normalmente
       * utilizarán WebM + Opus.
       *
       * El servidor lo convertirá
       * después a OGG + Opus.
       */
      if (
        MediaRecorder
          .isTypeSupported(
            'audio/ogg;codecs=opus'
          )
      ) {

        tipoAudio =
          'audio/ogg;codecs=opus';

      } else if (
        MediaRecorder
          .isTypeSupported(
            'audio/webm;codecs=opus'
          )
      ) {

        tipoAudio =
          'audio/webm;codecs=opus';

      } else {

        tipoAudio =
          'audio/webm';

      }


      mediaRecorder =
        new MediaRecorder(
          streamVoz,
          {
            mimeType:
              tipoAudio
          }
        );


      mediaRecorder
        .addEventListener(
          'dataavailable',
          event => {

            if (
              event.data &&
              event.data.size >
                0
            ) {

              audioChunks.push(
                event.data
              );

            }

          }
        );


      mediaRecorder
        .addEventListener(
          'stop',
          () => {

            clearInterval(
              intervaloGrabacionVoz
            );


            intervaloGrabacionVoz =
              null;


            cerrarStreamVoz();


            grabandoVoz =
              false;


            if (
              cancelarGrabacionActual
            ) {

              limpiarGrabadorVoz();

              return;

            }


            if (
              !audioChunks.length
            ) {

              limpiarGrabadorVoz();

              alert(
                'No se pudo obtener audio de la grabación.'
              );

              return;

            }


            const blob =
              new Blob(
                audioChunks,
                {
                  type:
                    tipoAudio
                }
              );


            const extension =
              tipoAudio.includes(
                'ogg'
              )
                ? 'ogg'
                : 'webm';


            archivoVozPendiente =
              new File(
                [
                  blob
                ],
                `nota_voz_${Date.now()}.${extension}`,
                {
                  type:
                    tipoAudio
                }
              );


            if (
              urlVozPendiente
            ) {

              URL.revokeObjectURL(
                urlVozPendiente
              );

            }


            urlVozPendiente =
              URL.createObjectURL(
                blob
              );


            previewVozAudio.src =
              urlVozPendiente;


            grabadorVozPanel
              .classList
              .add(
                'preview'
              );

          }
        );


      mediaRecorder.start(
        250
      );


      grabandoVoz =
        true;


      formEnviar
        .classList
        .add(
          'grabando-voz'
        );


      grabadorVozPanel
        .classList
        .remove(
          'preview'
        );


      iniciarCronometroVoz();


    } catch (error) {

      console.error(
        'ERROR MICROFONO:',
        error
      );


      limpiarGrabadorVoz();


      alert(
        'No se pudo acceder al micrófono.'
      );

    }

  }
);


// =======================================
// DETENER Y MOSTRAR PREVIEW
// =======================================

btnDetenerVoz.addEventListener(
  'click',
  () => {

    if (
      !mediaRecorder ||
      mediaRecorder.state !==
        'recording'
    ) {

      return;

    }


    mediaRecorder.stop();

  }
);


// =======================================
// CANCELAR / BORRAR
// =======================================

btnCancelarVoz.addEventListener(
  'click',
  () => {

    cancelarGrabacionActual =
      true;


    if (
      mediaRecorder &&
      mediaRecorder.state ===
        'recording'
    ) {

      mediaRecorder.stop();

      return;

    }


    limpiarGrabadorVoz();

  }
);


// =======================================
// ENVIAR NOTA DE VOZ
// =======================================

btnEnviarVoz.addEventListener(
  'click',
  async () => {

    if (
      !clienteActual ||
      !archivoVozPendiente
    ) {

      return;

    }


    const htmlOriginal =
      btnEnviarVoz.innerHTML;


    btnEnviarVoz.disabled =
      true;


    btnEnviarVoz.innerHTML =
      `
      <i
        class="fa-solid fa-spinner fa-spin"
      ></i>
      `;


    try {

      const formData =
        new FormData();


      formData.append(
        'cliente_id',
        clienteActual.id
      );


      formData.append(
        'telefono',
        clienteActual.telefono
      );


      /*
       * IMPORTANTE:
       * no mandamos "Nota de voz"
       * como mensaje de texto.
       */
      formData.append(
        'mensaje',
        ''
      );


      /*
       * Le indica al backend que
       * debe enviarlo como PTT.
       */
      formData.append(
        'es_nota_voz',
        '1'
      );


      formData.append(
        'archivo',
        archivoVozPendiente
      );


      const res =
        await fetch(
          '/api/enviar-media',
          {
            method:
              'POST',

            body:
              formData
          }
        );


      const data =
        await res.json();


      if (
        !res.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error?.error
            ?.message ||
          data.error
            ?.message ||
          data.error ||
          'No se pudo enviar la nota de voz.'
        );

      }


      limpiarGrabadorVoz();


      await cargarMensajes(
        clienteActual.id,
        true
      );


      await cargarClientes();


    } catch (error) {

      console.error(
        'ERROR ENVIANDO VOZ:',
        error
      );


      alert(
        error.message ||
        'No se pudo enviar la nota de voz.'
      );


    } finally {

      btnEnviarVoz.disabled =
        false;


      btnEnviarVoz.innerHTML =
        htmlOriginal;

    }

  }
);

function actualizarContadorSolicitudesAsesor() {

  const totalSolicitudesAsesor =
    clientes.filter(
      cliente =>
        Number(
          cliente.requiere_asesor || 0
        ) === 1
    ).length;


  if (!btnFiltroAsesor) {
    return;
  }


  btnFiltroAsesor.innerHTML = `
    👤 Solicita asesor
    ${
      totalSolicitudesAsesor > 0
        ? `
          <span class="contador-solicita-asesor">
            ${totalSolicitudesAsesor}
          </span>
        `
        : ''
    }
  `;

}
async function cargarClientes() {
const res = await fetch('/api/clientes');

clientes = await res.json();

actualizarContadorSolicitudesAsesor();

detectarNuevosMensajes(clientes);
  
if (clienteActual) {

  const actualizado =
    clientes.find(
      c =>
        String(c.id) ===
        String(clienteActual.id)
    );


 if (actualizado) {

  clienteActual =
    actualizado;


  // ==========================================
  // ACTUALIZAR DATOS VISIBLES DEL CHAT
  // ==========================================

  clienteNombre.textContent =
    clienteActual.nombre ||
    'Cliente WhatsApp';

  clienteTelefono.textContent =
    clienteActual.telefono ||
    '';


  // ==========================================
  // ACTUALIZAR AVATAR
  // ==========================================

  const avatarHeader =
    document.getElementById(
      'avatarHeader'
    );

  if (avatarHeader) {

    const nombreAvatar =
      clienteActual.nombre ||
      clienteActual.telefono ||
      'ZR';

    avatarHeader.textContent =
      obtenerIniciales(
        nombreAvatar
      );

    avatarHeader.style.background =
      colorAvatar(
        nombreAvatar
      );

  }


  actualizarContadorSesion(
    clienteActual
  );


  actualizarModoVisual(
    clienteActual.modo_atencion ||
    'bot'
  );

}
}


  if (!buscandoClientes || !buscarInput.value.trim()) {
  aplicarFiltro();
}
}
 
function pintarClientes(lista) {
  const scrollAnterior = clientesDiv.scrollTop;

  const idsVisibles = new Set(
    lista.map(cliente => String(cliente.id))
  );

  // Elimina solo las tarjetas que ya no pertenecen al filtro actual
  clientesDiv
    .querySelectorAll('.cliente-card[data-cliente-id]')
    .forEach(card => {
      if (!idsVisibles.has(card.dataset.clienteId)) {
        card.remove();
      }
    });

  lista.forEach((cliente, indice) => {
    const clienteId = String(cliente.id);

    let card = clientesDiv.querySelector(
      `.cliente-card[data-cliente-id="${clienteId}"]`
    );

    const noLeidos = Number(cliente.no_leidos || 0);
    const vencida = sesionClienteVencida(cliente);
    const nombreAvatar =
      cliente.nombre ||
      cliente.telefono ||
      'ZR';

    const nombreCliente =
      cliente.nombre || 'Cliente WhatsApp';

    const ultimoMensaje =
      cliente.ultimo_mensaje ||
      cliente.telefono ||
      '';

    const estadoCliente =
      cliente.estado || 'Nuevo';

    const asesorNombre =
      cliente.asesor_nombre || '';

    // Crear tarjeta únicamente si todavía no existe
    if (!card) {
      card = document.createElement('div');

      card.className = 'cliente-card';
      card.dataset.clienteId = clienteId;

      card.innerHTML = `
        <div class="cliente-lista">
          <div class="avatar avatar-lista"></div>

          <div class="cliente-contenido">
            <div class="cliente-top">
              <span class="cliente-nombre"></span>
              <span class="badge"></span>
            </div>

            <div class="ultimo">
              <span class="ultimo-texto"></span>
              <span class="zona-no-leidos"></span>
            </div>

            <div class="cliente-indicadores">
              <span class="indicador-sesion"></span>
              <span class="indicador-asesor"></span>
            </div>
          </div>
        </div>
      `;
card.addEventListener('click', () => {
  const clienteActualizado = clientes.find(
    item =>
      String(item.id) ===
      card.dataset.clienteId
  );

  if (clienteActualizado) {
    abrirChat(clienteActualizado);
  }
});

    }

    // Referencias internas
    const avatar = card.querySelector('.avatar-lista');
    const nombre = card.querySelector('.cliente-nombre');
    const badge = card.querySelector('.badge');
    const ultimo = card.querySelector('.ultimo-texto');
    const zonaNoLeidos = card.querySelector('.zona-no-leidos');
    const indicadorSesion =
      card.querySelector('.indicador-sesion');
    const indicadorAsesor =
      card.querySelector('.indicador-asesor');

    // Actualiza la tarjeta sin destruirla
    avatar.textContent = obtenerIniciales(nombreAvatar);
    avatar.style.background = colorAvatar(nombreAvatar);

    nombre.textContent = nombreCliente;
    badge.textContent = estadoCliente;

    ultimo.textContent = String(ultimoMensaje)
      .replace(/\n/g, ' ')
      .replace(/\*/g, '');

    zonaNoLeidos.innerHTML =
      noLeidos > 0
        ? `
          <span class="contador-no-leidos">
            ${noLeidos}
          </span>
        `
        : '';

    indicadorSesion.textContent =
      vencida ? 'Sesión vencida' : 'Sesión activa';

    indicadorSesion.className =
      `indicador-sesion ${vencida ? 'vencida' : 'activa'}`;

      

const requiereAsesor =
  Number(
    cliente.requiere_asesor || 0
  ) === 1;


if (requiereAsesor) {

  indicadorAsesor.textContent =
    '⚠️ Solicita asesor';

  indicadorAsesor.className =
    'indicador-asesor solicita-asesor';

} else {

  const estaConAsesor =
    String(
      cliente.modo_atencion || 'bot'
    )
      .trim()
      .toLowerCase() === 'asesor';


  if (estaConAsesor) {

    indicadorAsesor.textContent =
      cliente.asesor_nombre
        ? `👤 ${cliente.asesor_nombre}`
        : '👤 Asesor humano';

    indicadorAsesor.className =
      'indicador-asesor';

} else {

  if (
    cliente.asesor_nombre
  ) {

    indicadorAsesor.textContent =
      `🤖 Bot · 👤 ${cliente.asesor_nombre}`;

  } else {

    indicadorAsesor.textContent =
      '🤖 Bot · Sin asesor';

  }


  indicadorAsesor.className =
    'indicador-asesor bot-automatico';

}

}

    card.classList.toggle(
      'active',
      String(clienteActual?.id) === clienteId
    );

    // Mantiene el orden recibido desde el backend
    const elementoActual = clientesDiv.children[indice];

    if (elementoActual !== card) {
      clientesDiv.insertBefore(
        card,
        elementoActual || null
      );
    }
  });

  // Restaurar el scroll después de ordenar
  clientesDiv.scrollTop = scrollAnterior;
}
async function abrirChat(cliente) {
  const cambioDeCliente =
  String(clienteActual?.id || '') !== String(cliente.id);

clienteActual = cliente;

if (cambioDeCliente) {
  mensajesDiv.innerHTML = `
    <div class="estado-busqueda">
      Cargando conversación...
    </div>
  `;
}
  clienteActual = cliente;

  clienteNombre.textContent = cliente.nombre || 'Cliente WhatsApp';
  clienteTelefono.textContent = cliente.telefono;
actualizarContadorSesion(cliente);
  const avatarHeader = document.getElementById('avatarHeader');

  if (avatarHeader) {
    const nombreAvatar = cliente.nombre || cliente.telefono || 'ZR';
    avatarHeader.textContent = obtenerIniciales(nombreAvatar);
    avatarHeader.style.background = colorAvatar(nombreAvatar);
  }

  estadoSelect.value = cliente.estado || 'Nuevo';
  estadoSelect.disabled = false;
  textoMensaje.disabled = false;
  btnEnviar.disabled = false;

  btnTomar.disabled = false;
  btnFinalizar.disabled = false;
  btnBot.disabled = false;

  actualizarModoVisual(cliente.modo_atencion || 'bot');
const chatDeOtroAsesor =
  cliente.modo_atencion === 'asesor' &&
  cliente.asesor_nombre &&
  cliente.asesor_nombre !== usuarioLogueado?.nombre &&
  usuarioLogueado?.rol !== 'admin';

if (chatDeOtroAsesor) {
  textoMensaje.disabled = true;
  btnEnviar.disabled = true;
  btnAdjuntar.disabled = true;
  btnVoz.disabled = true;

  textoMensaje.placeholder =
    `Chat atendido por ${cliente.asesor_nombre}`;
} else {
  textoMensaje.disabled = false;
  btnEnviar.disabled = false;
  btnAdjuntar.disabled = false;
  btnVoz.disabled = false;

  textoMensaje.placeholder =
    cliente.modo_atencion === 'asesor'
      ? 'Responder como asesor...'
      : 'Escribe tu respuesta...';
}
  textoMensaje.placeholder =
    cliente.modo_atencion === 'asesor'
      ? 'Responder como asesor...'
      : 'Escribe tu respuesta...';

  await fetch(`/api/clientes/${cliente.id}/leido`, {
    method: 'POST'
  });

  cliente.no_leidos = 0;

const clienteEnLista = clientes.find(
  item => item.id === cliente.id
);

if (clienteEnLista) {
  clienteEnLista.no_leidos = 0;
}

clientesDiv
  .querySelectorAll('.cliente-card')
  .forEach(card => {
    card.classList.toggle(
      'active',
      card.dataset.clienteId === String(cliente.id)
    );
  });

const tarjetaAbierta = clientesDiv.querySelector(
  `.cliente-card[data-cliente-id="${cliente.id}"]`
);

if (tarjetaAbierta) {
  const zonaNoLeidos =
    tarjetaAbierta.querySelector('.zona-no-leidos');

  if (zonaNoLeidos) {
    zonaNoLeidos.innerHTML = '';
  }
}

await cargarMensajes(cliente.id, true);
}
function mantenerChatAbajo() {
  mensajesDiv.scrollTop = mensajesDiv.scrollHeight;
}

function generarOndaAudio() {

  const alturas = [
    8, 13, 19, 11,
    24, 16, 9, 21,
    28, 14, 20, 10,
    17, 26, 12, 22,
    15, 29, 18, 10,
    24, 13, 19, 27,
    11, 21, 15, 25,
    9, 18, 23, 12
  ];


  return alturas
    .map(
      altura =>
        `<span style="height:${altura}px"></span>`
    )
    .join('');

}

function obtenerContenidoMensaje(msg) {
  const tipo = String(
    msg.tipo_media || 'text'
  ).toLowerCase();

  const url = String(
    msg.media_url || ''
  ).trim();

  const nombreArchivo =
    msg.nombre_archivo ||
    (url ? url.split('/').pop() : '') ||
    msg.mensaje ||
    'Archivo';

  if (tipo === 'image' && url) {
    return `
      <div class="mensaje-media">
        <img
          class="media-img imagen-chat"
          src="${escapeHtml(url)}"
          alt="${escapeHtml(nombreArchivo)}"
          loading="eager"
          decoding="async"
          onclick="abrirImagen('${escapeHtml(url)}')"
        >

        ${
          msg.mensaje &&
          !String(msg.mensaje).toLowerCase()
            .includes('cliente envió una imagen')
            ? `
              <div class="caption-media">
                ${formatearMensaje(msg.mensaje)}
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  if (tipo === 'video' && url) {
    return `
      <div class="mensaje-media">
        <video
          class="media-video video-chat"
          controls
          preload="metadata"
          src="${escapeHtml(url)}">
        </video>

        ${
          msg.mensaje &&
          !String(msg.mensaje).toLowerCase()
            .includes('cliente envió un video')
            ? `
              <div class="caption-media">
                ${formatearMensaje(msg.mensaje)}
              </div>
            `
            : ''
        }
      </div>
    `;
  }

if (
  tipo === 'document' &&
  url
) {

  const nombre =
    escapeHtml(
      nombreArchivo
    );


  const icono =
    obtenerIconoDocumento(
      nombreArchivo,
      msg.mime_type || ''
    );


  return `
    <div class="mensaje-media">

      <a
        class="documento-chat"
        href="${escapeHtml(
          url
        )}"
        target="_blank"
        rel="noopener noreferrer"
      >

        <div class="documento-icono">
          ${icono}
        </div>

        <div class="documento-info">

          <strong>
            ${nombre}
          </strong>

          <span>
            ${escapeHtml(
              obtenerNombreTipoDocumento(
                nombreArchivo,
                msg.mime_type ||
                ''
              )
            )}
          </span>

        </div>

      </a>


      ${
        msg.mensaje &&
        String(
          msg.mensaje
        ).trim() !==
          String(
            nombreArchivo
          ).trim()

          ? `
            <div class="caption-media">
              ${formatearMensaje(
                msg.mensaje
              )}
            </div>
          `

          : ''
      }

    </div>
  `;
}

if (
  tipo === 'audio' &&
  url
) {

  return `
    <div
      class="audio-whatsapp"
    >

      <button
        type="button"
        class="audio-whatsapp-play"
      >
        <i
          class="fa-solid fa-play"
        ></i>
      </button>


      <div
        class="audio-whatsapp-centro"
      >

        <div
          class="audio-whatsapp-onda"
        >

          <div
            class="audio-onda-base"
          >
            ${generarOndaAudio()}
          </div>


          <div
            class="audio-onda-progreso"
          >
            ${generarOndaAudio()}
          </div>


          <input
            type="range"
            class="audio-whatsapp-range"
            min="0"
            max="1000"
            value="0"
          >

        </div>


        <div
          class="audio-whatsapp-info"
        >

          <span
            class="audio-whatsapp-tiempo"
          >
            0:00
          </span>

          <i
            class="fa-solid fa-microphone"
          ></i>

        </div>

      </div>


      <audio
        class="audio-whatsapp-element"
        preload="metadata"
        src="${escapeHtml(
          url
        )}"
      ></audio>

    </div>
  `;

}
  if (tipo === 'image' && !url) {
    return `
      <div class="archivo-no-disponible">
        🖼️ Imagen recibida, pero el archivo no fue guardado.
      </div>
    `;
  }

  if (tipo === 'video' && !url) {
    return `
      <div class="archivo-no-disponible">
        🎥 Video recibido, pero el archivo no fue guardado.
      </div>
    `;
  }

  if (tipo === 'document' && !url) {
    return `
      <div class="archivo-no-disponible">
        📄 ${escapeHtml(nombreArchivo)}
        <br>
        <small>El documento no fue descargado al servidor.</small>
      </div>
    `;
  }

  if (tipo === 'audio' && !url) {
    return `
      <div class="archivo-no-disponible">
        🎙️ Audio recibido, pero el archivo no fue guardado.
      </div>
    `;
  }

  return formatearMensaje(
    msg.mensaje || ''
  );
}

function obtenerNombreTipoDocumento(
  nombre = '',
  mime = ''
) {
  const nombreLimpio =
    String(nombre).toLowerCase();

  const mimeLimpio =
    String(mime).toLowerCase();

  if (
    nombreLimpio.endsWith('.pdf') ||
    mimeLimpio.includes('pdf')
  ) {
    return 'Documento PDF';
  }

  if (
    nombreLimpio.endsWith('.doc') ||
    nombreLimpio.endsWith('.docx') ||
    mimeLimpio.includes('word')
  ) {
    return 'Documento Word';
  }

  if (
    nombreLimpio.endsWith('.xls') ||
    nombreLimpio.endsWith('.xlsx') ||
    mimeLimpio.includes('excel') ||
    mimeLimpio.includes('spreadsheet')
  ) {
    return 'Documento Excel';
  }

  if (
    nombreLimpio.endsWith('.ppt') ||
    nombreLimpio.endsWith('.pptx') ||
    mimeLimpio.includes('presentation') ||
    mimeLimpio.includes('powerpoint')
  ) {
    return 'Presentación PowerPoint';
  }

  if (
    nombreLimpio.endsWith('.zip') ||
    nombreLimpio.endsWith('.rar') ||
    nombreLimpio.endsWith('.7z')
  ) {
    return 'Archivo comprimido';
  }

  return 'Documento adjunto';
}

function crearBurbujaMensaje(msg) {
  const div = document.createElement('div');

  div.className = `msg ${msg.tipo}`;
  div.dataset.mensajeId = String(msg.id);

  actualizarBurbujaMensaje(div, msg);

  return div;
}

function actualizarBurbujaMensaje(div, msg) {
  const contenido = obtenerContenidoMensaje(msg);

  const autorMensaje =
    msg.tipo === 'saliente' && msg.usuario_nombre
      ? `
        <div class="autor-mensaje">
          <i class="fa-solid fa-user"></i>
          ${escapeHtml(msg.usuario_nombre)}
        </div>
      `
      : '';

  const errorMensaje =
    msg.estado_mensaje === 'fallido'
      ? `
        <div class="mensaje-error-envio">
          No se pudo enviar
        </div>
      `
      : '';

  const botonReintentar =
    msg.tipo === 'saliente' &&
    msg.estado_mensaje === 'fallido'
      ? `
        <button
          type="button"
          class="btn-reintentar-mensaje"
        >
          <i class="fa-solid fa-rotate-right"></i>
          Reintentar
        </button>
      `
      : '';

  div.innerHTML = `
    ${autorMensaje}

    <div class="contenido">
      ${contenido}
    </div>

    ${errorMensaje}
    ${botonReintentar}

    <span class="fecha">
      ${formatearHora(msg.fecha)}

      <span class="estado-check">
        ${
          msg.tipo === 'saliente'
            ? obtenerCheckMensaje(msg.estado_mensaje)
            : ''
        }
      </span>
    </span>
  `;

  div.dataset.firma = [
    msg.estado_mensaje,
    msg.mensaje,
    msg.media_url,
    msg.usuario_nombre
  ].join('|');

  const boton = div.querySelector(
    '.btn-reintentar-mensaje'
  );

  if (boton) {
    boton.addEventListener('click', async () => {
      await reintentarMensaje(msg.id, boton);
    });
  }
inicializarAudioWhatsApp(
  div
);

}

function inicializarAudioWhatsApp(
  contenedor
) {

  const player =
    contenedor.querySelector(
      '.audio-whatsapp'
    );


  if (!player) {
    return;
  }


  const audio =
    player.querySelector(
      '.audio-whatsapp-element'
    );


  const boton =
    player.querySelector(
      '.audio-whatsapp-play'
    );


  const icono =
    boton?.querySelector(
      'i'
    );


  const range =
    player.querySelector(
      '.audio-whatsapp-range'
    );


  const tiempo =
    player.querySelector(
      '.audio-whatsapp-tiempo'
    );


  const progreso =
    player.querySelector(
      '.audio-onda-progreso'
    );


  if (
    !audio ||
    !boton ||
    !range
  ) {

    return;

  }


  function segundosATiempo(
    valor
  ) {

    if (
      !Number.isFinite(
        valor
      )
    ) {

      return '0:00';

    }


    const minutos =
      Math.floor(
        valor / 60
      );


    const segundos =
      Math.floor(
        valor % 60
      );


    return (
      `${minutos}:${
        String(
          segundos
        ).padStart(
          2,
          '0'
        )
      }`
    );

  }


  audio.addEventListener(
    'loadedmetadata',
    () => {

      tiempo.textContent =
        segundosATiempo(
          audio.duration
        );

    }
  );


  boton.addEventListener(
    'click',
    async () => {

      if (
        audio.paused
      ) {

        // Parar otros audios
        document
          .querySelectorAll(
            '.audio-whatsapp-element'
          )
          .forEach(
            otro => {

              if (
                otro !==
                audio
              ) {

                otro.pause();

              }

            }
          );


        await audio.play();


      } else {

        audio.pause();

      }

    }
  );


  audio.addEventListener(
    'play',
    () => {

      icono.className =
        'fa-solid fa-pause';

    }
  );


  audio.addEventListener(
    'pause',
    () => {

      icono.className =
        'fa-solid fa-play';

    }
  );


  audio.addEventListener(
    'ended',
    () => {

      icono.className =
        'fa-solid fa-play';

    }
  );


  audio.addEventListener(
    'timeupdate',
    () => {

      if (
        !audio.duration
      ) {
        return;
      }


      const porcentaje =
        audio.currentTime /
        audio.duration;


      range.value =
        Math.round(
          porcentaje *
          1000
        );


      progreso.style.width =
        `${
          porcentaje *
          100
        }%`;


      tiempo.textContent =
        segundosATiempo(
          audio.currentTime
        );

    }
  );


  range.addEventListener(
    'input',
    () => {

      if (
        !audio.duration
      ) {
        return;
      }


      const porcentaje =
        Number(
          range.value
        ) /
        1000;


      audio.currentTime =
        porcentaje *
        audio.duration;


      progreso.style.width =
        `${
          porcentaje *
          100
        }%`;

    }
  );

}



async function cargarMensajes(
  clienteId,
  forzarAbajo = false
) {
  try {
    const mismoCliente =
      String(clienteMensajesRenderizado) ===
      String(clienteId);

    const distanciaDesdeAbajo =
      mensajesDiv.scrollHeight -
      mensajesDiv.scrollTop -
      mensajesDiv.clientHeight;

    const estabaAbajo =
      distanciaDesdeAbajo < 100;

    const res = await fetch(
      `/api/mensajes/${clienteId}`
    );

    const mensajes = await res.json();

    if (!res.ok || !Array.isArray(mensajes)) {
      console.error(
        'Respuesta inválida de mensajes:',
        mensajes
      );
      return;
    }

    mensajesDiv.classList.remove('empty');

    /*
     * Solamente vaciamos el chat cuando el usuario
     * cambia de cliente.
     */
    if (!mismoCliente) {
       
      clienteMensajesRenderizado = clienteId;
    }

    const idsRecibidos = new Set(
      mensajes.map(msg => String(msg.id))
    );

    /*
     * Elimina únicamente mensajes que ya no existan.
     * Normalmente no habrá ninguno.
     */
    mensajesDiv
      .querySelectorAll('.msg[data-mensaje-id]')
      .forEach(elemento => {
        if (
          !idsRecibidos.has(elemento.dataset.mensajeId)
        ) {
          elemento.remove();
        }
      });

    let ultimaFechaMostrada = '';

    const separadoresActuales =
      mensajesDiv.querySelectorAll('.separador-fecha');

    if (separadoresActuales.length > 0) {
      ultimaFechaMostrada =
        separadoresActuales[
          separadoresActuales.length - 1
        ].textContent;
    }

    let huboMensajeNuevo = false;

    mensajes.forEach(msg => {
      const mensajeId = String(msg.id);

      const existente = mensajesDiv.querySelector(
        `.msg[data-mensaje-id="${mensajeId}"]`
      );

      const firmaNueva = [
        msg.estado_mensaje,
        msg.mensaje,
        msg.media_url,
        msg.usuario_nombre
      ].join('|');

      /*
       * Si ya existe, solo actualiza cuando cambió
       * el check, autor, contenido o estado.
       */
      if (existente) {
        if (existente.dataset.firma !== firmaNueva) {
          actualizarBurbujaMensaje(existente, msg);
        }

        return;
      }

      const fechaActual =
        obtenerEtiquetaFecha(msg.fecha);

      if (fechaActual !== ultimaFechaMostrada) {
        ultimaFechaMostrada = fechaActual;

        const separador =
          document.createElement('div');

        separador.className = 'separador-fecha';
        separador.textContent = fechaActual;

        mensajesDiv.appendChild(separador);
      }

      const burbuja = crearBurbujaMensaje(msg);

      mensajesDiv.appendChild(burbuja);
      huboMensajeNuevo = true;

      /*
       * Si la imagen o video aumenta de altura al
       * cargar, mantenemos el chat abajo sin saltos.
       */
      const medios = burbuja.querySelectorAll(
        'img.media-img, video.media-video'
      );

      medios.forEach(media => {
        const mantenerAbajo = () => {
          if (estabaAbajo || forzarAbajo) {
            mensajesDiv.scrollTop =
              mensajesDiv.scrollHeight;
          }
        };

        media.addEventListener(
          'load',
          mantenerAbajo,
          { once: true }
        );

        media.addEventListener(
          'loadedmetadata',
          mantenerAbajo,
          { once: true }
        );
      });
    });

    requestAnimationFrame(() => {
      if (
        forzarAbajo ||
        !mismoCliente ||
        (huboMensajeNuevo && estabaAbajo)
      ) {
        mensajesDiv.scrollTop =
          mensajesDiv.scrollHeight;

        return;
      }

      /*
       * Si estás leyendo mensajes antiguos,
       * conserva exactamente tu posición.
       */
      if (huboMensajeNuevo && !estabaAbajo) {
        mensajesDiv.scrollTop =
          mensajesDiv.scrollHeight -
          mensajesDiv.clientHeight -
          distanciaDesdeAbajo;
      }
    });

  } catch (error) {
    console.error(
      'ERROR CARGAR MENSAJES:',
      error
    );
  }
}

async function reintentarMensaje(mensajeId, boton) {
  if (!mensajeId || !boton) return;

  const textoAnterior = boton.innerHTML;

  boton.disabled = true;
  boton.innerHTML = `
    <i class="fa-solid fa-spinner fa-spin"></i>
    Reintentando...
  `;

  try {
    const res = await fetch(
      `/api/mensajes/${mensajeId}/reintentar`,
      {
        method: 'POST'
      }
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (data.bloqueado) {
        alert(data.error);
        return;
      }

      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : data.error?.message ||
            'No se pudo reenviar el mensaje'
      );
    }

    if (clienteActual) {
      await cargarMensajes(clienteActual.id, false);
      await cargarClientes();
    }

  } catch (error) {
    console.error('ERROR REINTENTO:', error);

    boton.disabled = false;
    boton.innerHTML = textoAnterior;

    alert(error.message || 'No se pudo reenviar.');
  }
}
formEnviar.addEventListener(
  'submit',
  async (e) => {

    e.preventDefault();


    if (!clienteActual) {
      return;
    }


    const mensaje =
      textoMensaje.value.trim();


    if (
      !mensaje &&
      !imagenRapidaSeleccionada
    ) {
      return;
    }


    btnEnviar.disabled =
      true;

    btnEnviar.textContent =
      'Enviando...';


    try {

      let res;


      // =====================================
      // RESPUESTA CON IMAGEN
      // =====================================

      if (
        imagenRapidaSeleccionada
      ) {

        const respuestaImagen =
          await fetch(
            imagenRapidaSeleccionada
          );


        if (
          !respuestaImagen.ok
        ) {

          throw new Error(
            'No se pudo cargar la imagen de la respuesta rápida.'
          );

        }


        const blob =
          await respuestaImagen.blob();


        let extension =
          'jpg';


        if (
          blob.type ===
          'image/png'
        ) {

          extension =
            'png';

        } else if (
          blob.type ===
          'image/webp'
        ) {

          extension =
            'webp';

        }


        const archivo =
          new File(
            [
              blob
            ],
            `respuesta-rapida.${extension}`,
            {
              type:
                blob.type ||
                'image/jpeg'
            }
          );


        const formData =
          new FormData();


        formData.append(
          'cliente_id',
          clienteActual.id
        );


        formData.append(
          'telefono',
          clienteActual.telefono
        );


        formData.append(
          'mensaje',
          mensaje
        );


        formData.append(
          'archivo',
          archivo
        );


        res =
          await fetch(
            '/api/enviar-media',
            {
              method:
                'POST',

              body:
                formData
            }
          );


      } else {

        // ===================================
        // RESPUESTA SOLO TEXTO
        // ===================================

        res =
          await fetch(
            '/api/enviar',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  cliente_id:
                    clienteActual.id,

                  telefono:
                    clienteActual.telefono,

                  mensaje
                })
            }
          );

      }


      const data =
        await res.json();


      if (
        !res.ok ||
        !data.ok
      ) {

        if (
          data.bloqueado
        ) {

          alert(
            data.error
          );

          return;

        }


        throw new Error(
          data.error?.error?.message ||
          data.error?.message ||
          data.error ||
          'No se pudo enviar el mensaje.'
        );

      }


      // =====================================
      // LIMPIAR
      // =====================================

      textoMensaje.value =
        '';


      seleccionarImagenRapida(
        ''
      );


      btnEnviar.textContent =
        'Enviado ✓';


      await cargarMensajes(
        clienteActual.id,
        true
      );


      await cargarClientes();


      setTimeout(
        () => {

          btnEnviar.textContent =
            'Enviar';

          btnEnviar.disabled =
            false;

        },
        1000
      );


    } catch (error) {

      console.error(
        'ERROR ENVIANDO RESPUESTA:',
        error
      );


      btnEnviar.textContent =
        'Error';


      alert(
        error.message ||
        'No se pudo enviar.'
      );


      setTimeout(
        () => {

          btnEnviar.textContent =
            'Enviar';

          btnEnviar.disabled =
            false;

        },
        1200
      );

    }

  }
);
estadoSelect.addEventListener('change', async () => {
  if (!clienteActual) return;

  await fetch(`/api/clientes/${clienteActual.id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: estadoSelect.value })
  });

  clienteActual.estado = estadoSelect.value;
  await cargarClientes();
});

buscarInput.addEventListener('input', () => {

  clearTimeout(temporizadorBusqueda);

  const texto = buscarInput.value.trim();

  temporizadorBusqueda = setTimeout(async () => {

    // Si está vacío vuelve a mostrar todos
    if (!texto) {
      buscandoClientes = false;
      aplicarFiltro();
      return;
    }

    // Si tiene menos de 2 caracteres no buscar
    if (texto.length < 2) {

      buscandoClientes = true;

      clientesDiv.innerHTML = `
        <div class="estado-busqueda">
          Escribe al menos 2 caracteres.
        </div>
      `;

      return;
    }

    await buscarClientesBackend(texto);

  }, 350);

});

async function buscarClientesBackend(texto) {
  try {
    buscandoClientes = true;

    clientesDiv.innerHTML = `
      <div class="estado-busqueda">
        Buscando clientes...
      </div>
    `;

    const res = await fetch(
      `/api/clientes/buscar?q=${encodeURIComponent(texto)}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || 'No se pudo realizar la búsqueda'
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      clientesDiv.innerHTML = `
        <div class="estado-busqueda">
          No se encontraron clientes.
        </div>
      `;
      return;
    }

    pintarClientes(data);

  } catch (error) {
    console.error('ERROR BUSCAR CLIENTES:', error);

    clientesDiv.innerHTML = `
      <div class="estado-busqueda error">
        Error al buscar clientes.
      </div>
    `;
  }
}

async function cambiarModoAtencion(modo) {
  if (!clienteActual) return;

  const res = await fetch('/api/clientes/modo-atencion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
  telefono: clienteActual.telefono,
  modo_atencion: modo,
 asesor_nombre: modo === 'asesor' ? usuarioLogueado.nombre : null
})
  });

const data = await res.json();

if (!res.ok || !data.ok) {
  console.error('Error modo atención:', data);

  alert(
    data.error ||
    'No se pudo cambiar el modo de atención.'
  );

  return;
}

clienteActual.modo_atencion =
  data.modo_atencion;

clienteActual.asesor_id =
  data.asesor_id;

clienteActual.asesor_nombre =
  data.asesor_nombre;

actualizarModoVisual(
  data.modo_atencion
);
 
  await cargarClientes();
}
btnTomar.addEventListener('click', async () => {
  if (!clienteActual) return;

  const perteneceAOtro =
    clienteActual.modo_atencion === 'asesor' &&
    clienteActual.asesor_nombre &&
    clienteActual.asesor_nombre !== usuarioLogueado?.nombre;

  if (perteneceAOtro && usuarioLogueado?.rol !== 'admin') {
    alert(`Este chat ya está siendo atendido por ${clienteActual.asesor_nombre}`);
    return;
  }

  await cambiarModoAtencion('asesor');
});

btnFinalizar.addEventListener(
  'click',
  async () => {

    if (!clienteActual) {
      return;
    }


    const confirmar =
      window.confirm(
        '¿Finalizar esta atención?\n\n' +
        'La conversación será archivada y el bot quedará activo. ' +
        'El cliente seguirá asignado al mismo asesor.'
      );


    if (!confirmar) {
      return;
    }


    btnFinalizar.disabled =
      true;


    const textoAnterior =
      btnFinalizar.innerHTML;


    btnFinalizar.innerHTML =
      `
      <i
        class="fa-solid fa-spinner fa-spin"
      ></i>
      Finalizando...
      `;


    try {

      const res =
        await fetch(
          `/api/clientes/${clienteActual.id}/finalizar`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json'
            }
          }
        );


      const data =
        await res.json();


      if (
        !res.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ||
          'No se pudo finalizar la atención.'
        );

      }


      /*
       * Actualizar objeto local.
       */
      clienteActual.modo_atencion =
        'bot';


      clienteActual.archivado =
        1;


      clienteActual.asesor_id =
        data.asesor_id;


      clienteActual.asesor_nombre =
        data.asesor_nombre;


      /*
       * Limpiar panel central.
       */
      clienteActual =
        null;


      clienteMensajesRenderizado =
        null;


      clienteNombre.textContent =
        'Selecciona un chat';


      clienteTelefono.textContent =
        'Los mensajes aparecerán aquí';


      mensajesDiv.innerHTML =
        `
        <div class="estado-busqueda">
          Conversación archivada correctamente.
        </div>
        `;


      mensajesDiv.classList.add(
        'empty'
      );


      estadoSelect.disabled =
        true;


      textoMensaje.disabled =
        true;


      btnEnviar.disabled =
        true;


      btnTomar.style.display =
        'none';


      btnBot.style.display =
        'none';


      btnFinalizar.disabled =
        true;


      seleccionarImagenRapida(
        ''
      );


      /*
       * Recargar bandeja.
       * El cliente ya no aparecerá
       * porque archivado = 1.
       */
      await cargarClientes();


      alert(
        'Atención finalizada.\n\n' +
        'La conversación fue archivada y el bot quedó activo.\n' +
        'Si el cliente vuelve a escribir, iniciará un nuevo flujo con el mismo asesor asignado.'
      );


    } catch (error) {

      console.error(
        'ERROR FINALIZANDO ATENCIÓN:',
        error
      );


      alert(
        error.message ||
        'No se pudo finalizar la atención.'
      );


      btnFinalizar.disabled =
        false;


    } finally {

      btnFinalizar.innerHTML =
        textoAnterior;

    }

  }
);

btnBot.addEventListener('click', async () => {
  await cambiarModoAtencion('bot');
});

function actualizarModoVisual(modo) {

  if (!modoAtencion) {
    return;
  }


  const modoNormalizado =
    String(
      modo || 'bot'
    )
      .trim()
      .toLowerCase();


  const modoTexto =
    modoAtencion.querySelector(
      '.modo-texto'
    );


  modoAtencion.classList.remove(
    'modo-bot',
    'modo-asesor'
  );


  // =====================================
  // ASESOR HUMANO
  // =====================================

  if (
    modoNormalizado ===
    'asesor'
  ) {

    modoAtencion.classList.add(
      'modo-asesor'
    );


    if (modoTexto) {

      modoTexto.textContent =
        clienteActual?.asesor_nombre
          ? `Asesor humano: ${clienteActual.asesor_nombre}`
          : 'Asesor humano';

    }


    // OCULTAR:
    // "Tomar conversación"
    if (btnTomar) {

      btnTomar.style.display =
        'none';

      btnTomar.disabled =
        true;

    }


    // MOSTRAR:
    // "Volver al bot"
    if (btnBot) {

      btnBot.style.display =
        'inline-flex';

      btnBot.disabled =
        false;

    }


    return;
  }


  // =====================================
  // BOT AUTOMÁTICO
  // =====================================

  modoAtencion.classList.add(
    'modo-bot'
  );


if (modoTexto) {

  modoTexto.textContent =
    clienteActual?.asesor_nombre

      ? `Bot automático · Seguimiento: ${clienteActual.asesor_nombre}`

      : 'Bot automático · Sin asesor';

}


  // MOSTRAR:
  // "Tomar conversación"
  if (btnTomar) {

    btnTomar.style.display =
      'inline-flex';

    btnTomar.disabled =
      false;

  }


  // OCULTAR:
  // "Volver al bot"
  if (btnBot) {

    btnBot.style.display =
      'none';

    btnBot.disabled =
      true;

  }

}

function formatearHora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-PE', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function obtenerEtiquetaFecha(fecha) {

  const d = new Date(fecha);

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate()-1);

  const mensaje = new Date(d);
  mensaje.setHours(0,0,0,0);

  if (mensaje.getTime() === hoy.getTime())
      return "Hoy";

  if (mensaje.getTime() === ayer.getTime())
      return "Ayer";

  return d.toLocaleDateString('es-PE',{
      day:'numeric',
      month:'long',
      year:'numeric'
  });
}

function escapeHtml(texto) {
  return String(texto || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatearMensaje(texto) {

    return escapeHtml(texto || '')

        .replace(/\\n/g,'<br>')
        .replace(/\n/g,'<br>')

        // Negrita
        .replace(/\*(.*?)\*/g,'<strong>$1</strong>')

        // Cursiva
        .replace(/_(.*?)_/g,'<em>$1</em>')

        // Tachado
        .replace(/~(.*?)~/g,'<del>$1</del>')

        // Código
        .replace(/```([\s\S]*?)```/g,'<pre>$1</pre>');

}

function formatearVistaPrevia(texto) {
  return escapeHtml(String(texto || '').replace(/\n/g, ' ').replace(/\*/g, ''));
}

function abrirImagen(url) {
  document.getElementById('imagenGrande').src = url;
  document.getElementById('modalImagen').style.display = 'flex';
}

function cerrarImagen() {
  document.getElementById('modalImagen').style.display = 'none';
  document.getElementById('imagenGrande').src = '';
}

cargarClientes();

setInterval(async () => {
  await cargarClientes();

  if (clienteActual) {
    await cargarMensajes(clienteActual.id, false);
  }
}, 8000);

// Activa notificaciones y desbloquea el audio con el primer clic
document.addEventListener(
  'click',
  async () => {

    await activarNotificaciones();

    const sonido = document.getElementById('sonidoNotificacion');

    if (sonido) {

      sonido.volume = 0.6;

      sonido.play()
        .then(() => {
          sonido.pause();
          sonido.currentTime = 0;
        })
        .catch(() => {});

    }

  },
  { once: true }
);
filtros.forEach(btn => {
  btn.addEventListener('click', () => {

    filtros.forEach(b => b.classList.remove('filtro-activo'));

    btn.classList.add('filtro-activo');

    filtroActual = btn.dataset.filtro;

    aplicarFiltro();
  });
});
function aplicarFiltro() {
  let lista = [...clientes];

  if (filtroActual === 'no_leidos') {
    lista = lista.filter(cliente =>
      Number(cliente.no_leidos || 0) > 0
    );
  }

  if (filtroActual === 'sesion_vencida') {
    lista = lista.filter(cliente =>
      sesionClienteVencida(cliente)
    );
  }

  if (filtroActual === 'sin_asesor') {
    lista = lista.filter(cliente =>
      !cliente.asesor_nombre
    );
  }

  if (filtroActual === 'bot') {
    lista = lista.filter(cliente =>
      cliente.modo_atencion === 'bot'
    );
  }

 if (
  filtroActual === 'mios'
) {

  lista =
    lista.filter(
      cliente =>
        Number(
          cliente.asesor_id
        ) ===
        Number(
          usuarioLogueado?.id
        )
    );

}

 // =======================================
  // CLIENTES QUE SOLICITARON ASESOR
  // =======================================

  if (filtroActual === 'requiere_asesor') {
    lista = lista.filter(
      cliente =>
        Number(
          cliente.requiere_asesor || 0
        ) === 1
    );
  }


  pintarClientes(lista);
}

function sesionClienteVencida(cliente) {
  if (!cliente.ultima_interaccion_cliente) {
    return true;
  }

  const ultimaInteraccion =
    new Date(cliente.ultima_interaccion_cliente).getTime();

  if (Number.isNaN(ultimaInteraccion)) {
    return true;
  }

  const limite24Horas = 24 * 60 * 60 * 1000;

  return Date.now() - ultimaInteraccion > limite24Horas;
}
 
function obtenerIniciales(nombre) {
  if (!nombre) return 'ZR';

  const limpio = String(nombre).trim();

  if (!limpio) return 'ZR';

  const palabras = limpio
    .split(/\s+/)
    .filter(Boolean);

  if (palabras.length === 1) {
    return palabras[0].substring(0, 2).toUpperCase();
  }

  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

function colorAvatar(nombre) {
  const colores = [
    '#0EA9D6',
    '#10B981',
    '#F97316',
    '#8B5CF6',
    '#EF4444',
    '#14B8A6',
    '#6366F1',
    '#EC4899'
  ];

  const texto = String(nombre || 'ZR');

  let hash = 0;

  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colores[Math.abs(hash) % colores.length];
}
 function obtenerIconoDocumento(nombre = '', mime = '') {

  const ext = nombre.split('.').pop().toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf'))
      return '📕';

  if (['doc','docx'].includes(ext) || mime.includes('word'))
      return '📘';

  if (['xls','xlsx'].includes(ext) ||
      mime.includes('excel') ||
      mime.includes('spreadsheet'))
      return '📗';

  if (['ppt','pptx'].includes(ext) ||
      mime.includes('presentation'))
      return '📙';

  if (['zip','rar','7z'].includes(ext))
      return '🗜️';

  if (['txt'].includes(ext))
      return '📄';

  return '📁';
}

function obtenerCheckMensaje(estado) {
  if (estado === 'enviado') return ' ✓';
  if (estado === 'entregado') return ' ✓✓';
  if (estado === 'leido') return ' <span class="check-leido">✓✓</span>';
  if (estado === 'fallido') return ' ⚠️';
  return '';
}
let intervaloSesion = null;

function actualizarContadorSesion(cliente) {

    if (intervaloSesion) {
        clearInterval(intervaloSesion);
    }

    if (!cliente.ultima_interaccion_cliente) {
        clienteTelefono.textContent =
            cliente.telefono + " • Sesión vencida";
        return;
    }

    function refrescar() {

        const ultima = new Date(cliente.ultima_interaccion_cliente);

        const vence = new Date(
            ultima.getTime() + (24 * 60 * 60 * 1000)
        );

        const restante = vence - new Date();

        if (restante <= 0) {

            clienteTelefono.textContent =
                cliente.telefono + " • Sesión vencida";

            return;
        }

        const horas = Math.floor(restante / 3600000);

        const minutos = Math.floor(
            (restante % 3600000) / 60000
        );

        clienteTelefono.textContent =
            `${cliente.telefono} • La sesión finaliza en: ${horas}h ${minutos}m`;
    }

    refrescar();

    intervaloSesion = setInterval(refrescar, 60000);
}
// =======================================
// USUARIO LOGUEADO
// =======================================
 
 // =======================================
// USUARIO LOGUEADO / PANEL CUENTA
// =======================================

const btnCuenta = document.getElementById("btnCuenta");
const panelCuenta = document.getElementById("panelCuenta");
const cerrarPanelCuenta = document.getElementById("cerrarPanelCuenta");

const panelUsuarioNombre = document.getElementById("panelUsuarioNombre");
const panelUsuarioRol = document.getElementById("panelUsuarioRol");
const panelUsuarioId = document.getElementById("panelUsuarioId");
const panelUsuarioCuenta = document.getElementById("panelUsuarioCuenta");
const avatarUsuarioPanel = document.getElementById("avatarUsuarioPanel");

const btnLogoutPanel = document.getElementById("btnLogoutPanel");
const btnPerfil = document.getElementById("btnPerfil");

async function cargarUsuarioActual() {
  const res = await fetch("/api/me");

  if (!res.ok) {
    window.location.href = "/login.html";
    return;
  }

  const data = await res.json();
  usuarioLogueado = data.usuario;
 permisosUsuarioActual =
    normalizarPermisosFrontend(
      usuarioLogueado.permisos
    );

  perfilPermisosActual =
    usuarioLogueado.perfil_permisos ||
    'personalizado';

  // Consulta la versión actual almacenada
  // directamente en el servidor.
  await cargarPermisosUsuarioActual();
 
 
ocultarElementoPorPermiso(
  btnAuditoria,
  'auditoria',
  'ver'
);

ocultarElementoPorPermiso(
  btnNuevoUsuario,
  'usuarios',
  'crear'
);

ocultarElementoPorPermiso(
  btnPanelUsuarios,
  'usuarios',
  'ver'
);

ocultarElementoPorPermiso(
  btnModuloPagos,
  'pagos',
  'ver'
);

ocultarElementoPorPermiso(
  btnVistaEmbudo,
  'embudo',
  'ver'
);

ocultarElementoPorPermiso(
  btnVistaSeguimientos,
  'seguimientos',
  'ver'
);

ocultarElementoPorPermiso(
  btnEditarRapidas,
  'respuestas_rapidas',
  'editar'
);

ocultarElementoPorPermiso(
  btnAgregarRapida,
  'respuestas_rapidas',
  'crear'
);

 
  if (panelUsuarioNombre) {
    panelUsuarioNombre.textContent =
      usuarioLogueado.nombre;
  }

  if (panelUsuarioRol) {
    panelUsuarioRol.textContent =
      usuarioLogueado.rol;
  }

  if (panelUsuarioCuenta) {
    panelUsuarioCuenta.textContent =
      usuarioLogueado.usuario;
  }

  if (panelUsuarioId) {
    panelUsuarioId.textContent =
      usuarioLogueado.id;
  }

  if (avatarUsuarioPanel) {
    if (usuarioLogueado.foto_url) {
      avatarUsuarioPanel.src =
        usuarioLogueado.foto_url;
    } else {
      avatarUsuarioPanel.outerHTML = `
        <div
          class="avatar-usuario"
          id="avatarUsuarioPanel"
        >
          ${obtenerIniciales(
            usuarioLogueado.nombre
          )}
        </div>
      `;
    }
  }
}

if (btnCuenta && panelCuenta) {
  btnCuenta.addEventListener("click", (e) => {
    e.stopPropagation();
    panelCuenta.classList.toggle("abierto");
  });
}

if (cerrarPanelCuenta && panelCuenta) {
  cerrarPanelCuenta.addEventListener("click", (e) => {
    e.stopPropagation();
    panelCuenta.classList.remove("abierto");
  });
}

if (panelCuenta && btnCuenta) {
  document.addEventListener("click", (e) => {
    if (
      !panelCuenta.contains(e.target) &&
      !btnCuenta.contains(e.target)
    ) {
      panelCuenta.classList.remove("abierto");
    }
  });
}

if (btnPerfil) {
  btnPerfil.addEventListener("click", (e) => {
    e.stopPropagation();
    alert("Próximamente podrás editar tu perfil.");
  });
}

if (btnLogoutPanel) {
  btnLogoutPanel.addEventListener("click", async (e) => {
    e.stopPropagation();

    await fetch("/api/logout", {
      method: "POST"
    });

    window.location.href = "/login.html";
  });
}


 

const btnLogoutMenu = document.getElementById('btnLogoutMenu');

if (btnLogoutMenu) {
  btnLogoutMenu.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}




if (btnNuevoUsuario) {
  btnNuevoUsuario.addEventListener('click', () => {
    if (usuarioLogueado?.rol !== 'admin') {
      alert('Solo el administrador puede crear usuarios.');
      return;
    }

    modalUsuario.classList.add('mostrar');
  });
}

if (cerrarModalUsuario) {
  cerrarModalUsuario.addEventListener('click', () => {
    modalUsuario.classList.remove('mostrar');
  });
}

if (formUsuario) {
  formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(formUsuario);
     formData.set(
  'peso_asignacion',
  document.getElementById('pesoAsignacion').value || '1'
);

formData.set(
  'recibe_clientes',
  document.getElementById('recibeClientes').checked ? '1' : '0'
);

formData.set(
  'max_conversaciones',
  document.getElementById('maxConversaciones').value || ''
);
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || 'No se pudo crear el usuario.');
      return;
    }

    alert('Usuario creado correctamente.');
    formUsuario.reset();
    modalUsuario.classList.remove('mostrar');
  });
}
const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", () => {
    if (password.type === "password") {
        password.type = "text";
        togglePassword.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        password.type = "password";
        togglePassword.classList.replace("fa-eye-slash", "fa-eye");
    }
});
cargarRespuestasRapidas();

const btnPanelUsuarios = document.getElementById('btnPanelUsuarios');
const modalUsuariosRegistrados = document.getElementById('modalUsuariosRegistrados');
const cerrarModalUsuarios = document.getElementById('cerrarModalUsuarios');
const listaUsuariosRegistrados = document.getElementById('listaUsuariosRegistrados');

if (btnPanelUsuarios) {
  btnPanelUsuarios.addEventListener('click', async () => {
    if (usuarioLogueado?.rol !== 'admin') {
      alert('Solo el administrador puede ver usuarios.');
      return;
    }

    await cargarUsuariosRegistrados();
    modalUsuariosRegistrados.classList.add('mostrar');
  });
}

if (cerrarModalUsuarios) {
  cerrarModalUsuarios.addEventListener('click', () => {
    modalUsuariosRegistrados.classList.remove('mostrar');
  });
}

async function cargarUsuariosRegistrados() {
  const res = await fetch('/api/usuarios');
  const usuarios = await res.json();

  if (!res.ok) {
    alert(usuarios.error || 'No se pudo cargar usuarios.');
    return;
  }

  usuariosRegistrados = usuarios;

  listaUsuariosRegistrados.innerHTML = usuarios.map(u => `
    <div class="usuario-card">
      <img src="${u.foto_url || 'img/NUEVO-LOGO-ZR-MEDIC---EDITABLE.png'}" class="usuario-card-img">

      <div class="usuario-info">
        <strong>${escapeHtml(u.nombre)}</strong>
        <p>@${escapeHtml(u.usuario)} · ${escapeHtml(u.rol)}</p>
        <small>${u.activo ? 'Activo' : 'Inactivo'}</small>
      </div>

      <div class="usuario-acciones">
        <button onclick="abrirEditarUsuario(${u.id})">Editar</button>
        <button onclick="abrirClaveUsuario(${u.id})">Clave</button>
        <button class="danger" onclick="abrirEliminarUsuario(${u.id})">Eliminar</button>
      </div>
    </div>
  `).join('');
}
function escapeJs(texto) {
  return String(texto || '').replaceAll("'", "\\'");
}

 const modalEditarUsuario = document.getElementById('modalEditarUsuario');
const formEditarUsuario = document.getElementById('formEditarUsuario');
const cerrarEditarUsuario = document.getElementById('cerrarEditarUsuario');

const modalClaveUsuario = document.getElementById('modalClaveUsuario');
const formClaveUsuario = document.getElementById('formClaveUsuario');
const cerrarClaveUsuario = document.getElementById('cerrarClaveUsuario');

const modalEliminarUsuario = document.getElementById('modalEliminarUsuario');
const cerrarEliminarUsuario = document.getElementById('cerrarEliminarUsuario');
const confirmarEliminarUsuario = document.getElementById('confirmarEliminarUsuario');

function abrirEditarUsuario(id) {
  const u = usuariosRegistrados.find(x => x.id == id);
  if (!u) return;

  document.getElementById('editId').value = u.id;
  document.getElementById('editNombre').value = u.nombre;
  document.getElementById('editUsuario').value = u.usuario;
  document.getElementById('editRol').value = u.rol;
  document.getElementById('editActivo').value =
    Number(u.activo) === 1 ? '1' : '0';

  document.getElementById('editPesoAsignacion').value =
    Number(u.peso_asignacion) || 1;

  document.getElementById('editRecibeClientes').checked =
    Number(u.recibe_clientes) === 1;

  document.getElementById('editMaxConversaciones').value =
    u.max_conversaciones ?? '';

  actualizarCamposEditarUsuario();

  modalEditarUsuario.classList.add('mostrar');
}

function abrirClaveUsuario(id) {
  document.getElementById('claveId').value = id;
  document.getElementById('nuevaClave').value = '';
  document.getElementById('confirmarClave').value = '';

  modalClaveUsuario.classList.add('mostrar');
}

function abrirEliminarUsuario(id) {
  document.getElementById('eliminarId').value = id;
  modalEliminarUsuario.classList.add('mostrar');
}

cerrarEditarUsuario.addEventListener('click', () => {
  modalEditarUsuario.classList.remove('mostrar');
});

cerrarClaveUsuario.addEventListener('click', () => {
  modalClaveUsuario.classList.remove('mostrar');
});

cerrarEliminarUsuario.addEventListener('click', () => {
  modalEliminarUsuario.classList.remove('mostrar');
});

formEditarUsuario.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('editId').value;

  const formData = new FormData();
  formData.append('nombre', document.getElementById('editNombre').value);
  formData.append('usuario', document.getElementById('editUsuario').value);
  formData.append('rol', document.getElementById('editRol').value);
  formData.append('activo', document.getElementById('editActivo').value);
 formData.append(
  'peso_asignacion',
  document.getElementById('editPesoAsignacion').value || '1'
);

formData.append(
  'recibe_clientes',
  document.getElementById('editRecibeClientes').checked ? '1' : '0'
);

formData.append(
  'max_conversaciones',
  document.getElementById('editMaxConversaciones').value || ''
);
  const foto = document.getElementById('editFoto').files[0];
  if (foto) formData.append('foto', foto);

  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT',
    body: formData
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert(data.error || 'No se pudo actualizar usuario.');
    return;
  }

  modalEditarUsuario.classList.remove('mostrar');
  await cargarUsuariosRegistrados();
});

formClaveUsuario.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('claveId').value;
  const password = document.getElementById('nuevaClave').value;
  const confirmar = document.getElementById('confirmarClave').value;

  if (password !== confirmar) {
    alert('Las contraseñas no coinciden.');
    return;
  }

  const res = await fetch(`/api/usuarios/${id}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert(data.error || 'No se pudo cambiar contraseña.');
    return;
  }

  modalClaveUsuario.classList.remove('mostrar');
});

confirmarEliminarUsuario.addEventListener('click', async () => {
  const id = document.getElementById('eliminarId').value;

  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'DELETE'
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert(data.error || 'No se pudo eliminar usuario.');
    return;
  }

  modalEliminarUsuario.classList.remove('mostrar');
  await cargarUsuariosRegistrados();
});
function mostrarEstadoConexion(texto, tipo = 'info') {
  const estado = document.getElementById('estadoConexion');
  if (!estado) return;

  estado.textContent = texto;
  estado.className = `estado-conexion ${tipo}`;
}
const btnAuditoria = document.getElementById('btnAuditoria');
const modalAuditoria = document.getElementById('modalAuditoria');
const cerrarAuditoria = document.getElementById('cerrarAuditoria');
const listaAuditoria = document.getElementById('listaAuditoria');
const buscarAuditoria = document.getElementById('buscarAuditoria');
const filtroAccionAuditoria = document.getElementById('filtroAccionAuditoria');

let registrosAuditoria = [];

if (btnAuditoria) {
  btnAuditoria.addEventListener('click', async () => {
    if (usuarioLogueado?.rol !== 'admin') {
      alert('Solo el administrador puede ver la auditoría.');
      return;
    }

    await cargarAuditoria();
    modalAuditoria.classList.add('mostrar');
  });
}

if (cerrarAuditoria) {
  cerrarAuditoria.addEventListener('click', () => {
    modalAuditoria.classList.remove('mostrar');
  });
}

async function cargarAuditoria() {
  try {
    listaAuditoria.innerHTML = '<p>Cargando auditoría...</p>';

    const res = await fetch('/api/auditoria?limite=200');
    const data = await res.json();

    if (!res.ok) {
      listaAuditoria.innerHTML = `
        <p class="auditoria-error">
          ${escapeHtml(data.error || 'No se pudo cargar la auditoría')}
        </p>
      `;
      return;
    }

    registrosAuditoria = data;
    pintarAuditoria();

  } catch (error) {
    console.error(error);

    listaAuditoria.innerHTML = `
      <p class="auditoria-error">
        Error conectando con el servidor
      </p>
    `;
  }
}

function pintarAuditoria() {
  const texto = String(buscarAuditoria.value || '')
    .trim()
    .toLowerCase();

  const accion = filtroAccionAuditoria.value;

  const filtrados = registrosAuditoria.filter(registro => {
    const coincideAccion =
      !accion || registro.accion === accion;

    const contenido = [
      registro.usuario_nombre,
      registro.accion,
      registro.entidad,
      registro.detalle,
      registro.ip
    ]
      .join(' ')
      .toLowerCase();

    const coincideTexto =
      !texto || contenido.includes(texto);

    return coincideAccion && coincideTexto;
  });

  if (filtrados.length === 0) {
    listaAuditoria.innerHTML = `
      <p class="auditoria-vacia">
        No se encontraron registros.
      </p>
    `;
    return;
  }

  listaAuditoria.innerHTML = filtrados.map(registro => {
    let detalle = registro.detalle || '';

    try {
      const detalleJson = JSON.parse(detalle);
      detalle = Object.entries(detalleJson)
        .map(([clave, valor]) => `
          <span>
            <strong>${escapeHtml(clave)}:</strong>
            ${escapeHtml(String(valor ?? ''))}
          </span>
        `)
        .join('');
    } catch {
      detalle = escapeHtml(detalle);
    }

    return `
      <div class="auditoria-item">
        <div class="auditoria-item-top">
          <div>
            <strong>${escapeHtml(registro.usuario_nombre || 'Sistema')}</strong>
            <span class="auditoria-accion">
              ${formatearAccionAuditoria(registro.accion)}
            </span>
          </div>

          <small>${formatearFechaAuditoria(registro.fecha)}</small>
        </div>

        <div class="auditoria-meta">
          <span>
            Entidad:
            <strong>${escapeHtml(registro.entidad || '-')}</strong>
          </span>

          <span>
            ID:
            <strong>${escapeHtml(registro.entidad_id || '-')}</strong>
          </span>

          <span>
            IP:
            <strong>${escapeHtml(registro.ip || '-')}</strong>
          </span>
        </div>

        <div class="auditoria-detalle">
          ${detalle || 'Sin detalle'}
        </div>
      </div>
    `;
  }).join('');
}

function formatearAccionAuditoria(accion) {
  const nombres = {
    ENVIAR_MENSAJE: 'Envió un mensaje',
    ENVIAR_ARCHIVO: 'Envió un archivo',
    TOMAR_CONVERSACION: 'Tomó una conversación',
    VOLVER_AL_BOT: 'Devolvió al bot',
    CAMBIAR_ESTADO_CLIENTE: 'Cambió estado del cliente',
    CREAR_USUARIO: 'Creó un usuario',
    EDITAR_USUARIO: 'Editó un usuario',
    CAMBIAR_PASSWORD: 'Cambió una contraseña',
    DESACTIVAR_USUARIO: 'Desactivó un usuario',
    REINTENTAR_MENSAJE: 'Reintentó un mensaje fallido',
  };

  return nombres[accion] || accion;
}

function formatearFechaAuditoria(fecha) {
  return new Date(fecha).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

buscarAuditoria.addEventListener('input', pintarAuditoria);
filtroAccionAuditoria.addEventListener('change', pintarAuditoria);
async function activarNotificaciones() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no admite notificaciones.');
    return false;
  }

  if (Notification.permission === 'granted') {
    notificacionesActivadas = true;
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('Las notificaciones están bloqueadas.');
    return false;
  }

  const permiso = await Notification.requestPermission();

  notificacionesActivadas = permiso === 'granted';

  return notificacionesActivadas;
}
function guardarPreferenciaNotificaciones(estado) {
  localStorage.setItem(
    'notificaciones_crm',
    estado ? '1' : '0'
  );
}

function mostrarNotificacionCliente(cliente) {
  const nombre =
    cliente.nombre ||
    cliente.telefono ||
    'Nuevo mensaje';

  const mensaje =
    cliente.ultimo_mensaje ||
    'Tienes un mensaje nuevo';

  reproducirSonidoNotificacion();

  if (
    notificacionesActivadas &&
    Notification.permission === 'granted'
  ) {
    const notificacion = new Notification(
      `Nuevo mensaje de ${nombre}`,
      {
        body: mensaje,
        icon: '/img/NUEVO-LOGO-ZR-MEDIC---EDITABLE.png',
      tag: `cliente-${cliente.id}-${Date.now()}`
      }
    );

    notificacion.onclick = () => {
      window.focus();

      const encontrado = clientes.find(
        c => c.id === cliente.id
      );

      if (encontrado) {
        abrirChat(encontrado);
      }

      notificacion.close();
    };
  }
}
function reproducirSonidoNotificacion() {
  const sonido =
    document.getElementById('sonidoNotificacion');

  if (!sonido) return;

  sonido.currentTime = 0;
  sonido.volume = 0.7;

  sonido.play().catch(error => {
    console.warn(
      'El navegador bloqueó el sonido:',
      error.message
    );
  });
}
function detectarNuevosMensajes(listaClientes) {

  listaClientes.forEach(cliente => {

    const anterior =
      estadoClientesAnterior.get(cliente.id);

    if (anterior) {

      const cambioMensaje =
        cliente.ultimo_mensaje !== anterior.ultimoMensaje;

      const cambioFecha =
        cliente.fecha_actualizacion !== anterior.fechaActualizacion;

      const chatAbierto =
        clienteActual?.id === cliente.id;

      if (
        !chatAbierto &&
        (cambioMensaje || cambioFecha)
      ) {
        mostrarNotificacionCliente(cliente);
      }

    }

    estadoClientesAnterior.set(cliente.id,{
      noLeidos:Number(cliente.no_leidos||0),
      ultimoMensaje:cliente.ultimo_mensaje,
      fechaActualizacion:cliente.fecha_actualizacion
    });

  });

}
const btnNotificaciones =
  document.getElementById('btnNotificaciones');
function actualizarBotonNotificaciones() {
  if (btnNotificaciones) {
    btnNotificaciones.classList.toggle(
      'activo',
      notificacionesActivadas
    );
  }

  if (estadoNotificacionesAjustes) {
    estadoNotificacionesAjustes.textContent =
      notificacionesActivadas ? 'ON' : 'OFF';

    estadoNotificacionesAjustes.classList.toggle(
      'activo',
      notificacionesActivadas
    );
  }
}

actualizarBotonNotificaciones();

if (btnNotificaciones) {
  btnNotificaciones.addEventListener('click', async () => {
    if (notificacionesActivadas) {
      notificacionesActivadas = false;
      guardarPreferenciaNotificaciones(false);
      actualizarBotonNotificaciones();
      return;
    }

    const activadas =
      await activarNotificaciones();

    notificacionesActivadas = activadas;
    guardarPreferenciaNotificaciones(activadas);
    actualizarBotonNotificaciones();

    if (
      !activadas &&
      Notification.permission === 'denied'
    ) {
      alert(
        'Las notificaciones están bloqueadas en Chrome.'
      );
    }
  });
}

 // =======================================
// MÓDULO DE VERIFICACIÓN DE PAGOS
// =======================================
// =======================================
// CAJA: PAGOS, PEDIDOS Y FACTURACIÓN
// =======================================

let pagosPendientesActuales = [];

let pedidosFacturacionActuales = [];
let filtroFacturacionActual = 'pendientes';

const MEDIOS_PAGO_CAJA = [
  ['yape', 'Yape'],
  ['plin', 'Plin'],
  [
    'transferencia',
    'Transferencia bancaria'
  ],
  [
    'tarjeta_pos',
    'Tarjeta / POS'
  ],
  [
    'efectivo',
    'Efectivo'
  ],
  [
    'deposito',
    'Depósito bancario'
  ],
  [
    'otro',
    'Otro'
  ]
];


function numeroMoneda(valor) {
  const numero =
    Number(valor || 0);

  return Number.isFinite(numero)
    ? numero
    : 0;
}


function etiquetaMedioPago(valor) {
  const clave =
    String(
      valor || ''
    )
      .trim()
      .toLowerCase();

  return (
    MEDIOS_PAGO_CAJA.find(
      item =>
        item[0] === clave
    )?.[1] ||
    clave ||
    'No especificado'
  );
}


function etiquetaTipoEntrega(valor) {
  const tipo =
    String(
      valor || ''
    )
      .trim()
      .toLowerCase();

  const etiquetas = {
    lima:
      'Delivery en Lima',

    delivery_lima:
      'Delivery en Lima',

    recojo:
      'Recojo en tienda',

    recojo_tienda:
      'Recojo en tienda',

    provincia:
      'Envío a provincia',

    envio_provincia:
      'Envío a provincia'
  };

  return (
    etiquetas[tipo] ||
    valor ||
    'No especificada'
  );
}

// =======================================
// SABER SI PEDIDO ESTÁ FACTURADO
// =======================================

function pedidoEstaFacturado(
    pedido
) {

    const estado =
        String(
            pedido.estado_facturacion ||
            ''
        )
            .trim()
            .toLowerCase();


    return [
        'enviado',
        'completado'
    ].includes(
        estado
    );
}


// =======================================
// ACTUALIZAR CONTADORES
// =======================================

function actualizarContadoresPedidos() {

    const pendientes =
        pedidosFacturacionActuales.filter(
            pedido =>
                !pedidoEstaFacturado(
                    pedido
                )
        ).length;


    const facturados =
        pedidosFacturacionActuales.filter(
            pedido =>
                pedidoEstaFacturado(
                    pedido
                )
        ).length;


    if (
        contadorPedidosPendientes
    ) {

        contadorPedidosPendientes
            .textContent =
            pendientes;

    }


    if (
        contadorPedidosFacturados
    ) {

        contadorPedidosFacturados
            .textContent =
            facturados;

    }

}
function actualizarResumenCaja() {

  if (statPagosPendientes) {
    statPagosPendientes.textContent =
      String(
        pagosPendientesActuales.length
      );
  }


  const pendientesFacturacion =
    pedidosFacturacionActuales.filter(
      pedido => {

        const estado =
          String(
            pedido.estado_facturacion ||
            ''
          )
            .trim()
            .toLowerCase();

        return ![
          'enviado',
          'completado'
        ].includes(
          estado
        );
      }
    ).length;


  if (statPedidosFacturacion) {
    statPedidosFacturacion.textContent =
      String(
        pendientesFacturacion
      );
  }


  const listosDespacho =
    pedidosFacturacionActuales.filter(
      pedido => {

        const estadoPedido =
          String(
            pedido.estado_pedido ||
            ''
          )
            .trim()
            .toLowerCase();

        return [
          'listo_despacho',
          'despacho'
        ].includes(
          estadoPedido
        );
      }
    ).length;


  if (statListosDespacho) {
    statListosDespacho.textContent =
      String(
        listosDespacho
      );
  }
}


function cambiarTabCaja(tab) {

  const mostrarPagos =
    tab !== 'pedidos';


  tabCajaPagos?.classList.toggle(
    'activo',
    mostrarPagos
  );


  tabCajaPedidos?.classList.toggle(
    'activo',
    !mostrarPagos
  );


  panelCajaPagos?.classList.toggle(
    'oculto',
    !mostrarPagos
  );


  panelCajaPedidos?.classList.toggle(
    'oculto',
    mostrarPagos
  );


  if (!mostrarPagos) {
    cargarPedidosFacturacion();
  }
}
async function cargarPagosPendientes() {
  if (!listaPagosPendientes) return;

  listaPagosPendientes.innerHTML = `
    <div class="estado-busqueda">
      Cargando comprobantes...
    </div>
  `;

  try {
    const res = await fetch(
      '/api/pagos/pendientes'
    );

    const contentType =
      res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error(
        `El servidor respondió con formato incorrecto. Estado: ${res.status}`
      );
    }

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        'No se pudieron cargar los comprobantes.'
      );
    }

    const pagos = Array.isArray(data.pagos)
      ? data.pagos
      : [];
    pagosPendientesActuales =
  pagos;

actualizarResumenCaja();
    if (contadorPagosPendientes) {
      contadorPagosPendientes.textContent =
        `${pagos.length} comprobante${
          pagos.length === 1 ? '' : 's'
        } pendiente${
          pagos.length === 1 ? '' : 's'
        }`;
    }

    if (!pagos.length) {
      listaPagosPendientes.innerHTML = `
        <div class="sin-pagos">
          ✅ No hay comprobantes pendientes.
        </div>
      `;
      return;
    }

    listaPagosPendientes.innerHTML =
      pagos.map(crearTarjetaPago).join('');

  } catch (error) {
    console.error(
      'ERROR CARGANDO PAGOS:',
      error
    );

    listaPagosPendientes.innerHTML = `
      <div class="estado-busqueda error">
        ${escapeHtml(
          error.message ||
          'No se pudieron cargar los pagos.'
        )}
      </div>
    `;
  }
}
function crearTarjetaPago(pago) {
  const url = String(
    pago.comprobante_url || ''
  ).trim();

  const tipo = String(
    pago.comprobante_tipo || ''
  ).toLowerCase();

  const nombreArchivo = String(
    pago.nombre_archivo || ''
  );

  const esPdf =
    tipo === 'document' ||
    tipo === 'pdf' ||
    url.toLowerCase().endsWith('.pdf') ||
    nombreArchivo.toLowerCase().endsWith('.pdf');

  let comprobanteHtml = `
    <div class="archivo-no-disponible">
      Comprobante no disponible
    </div>
  `;

  if (url && esPdf) {
    comprobanteHtml = `
      <a
        href="${escapeHtml(url)}"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-ver-pdf"
      >
        📄 Ver comprobante PDF
      </a>
    `;
  } else if (url) {
    comprobanteHtml = `
      <img
        src="${escapeHtml(url)}"
        alt="Comprobante de pago"
        class="comprobante-imagen"
        loading="lazy"
        onclick="abrirImagen('${escapeJs(url)}')"
      >
    `;
  }

  // ==========================================
  // FECHA DEL COMPROBANTE
  // ==========================================

  const fecha = pago.fecha_creacion
    ? new Date(
        pago.fecha_creacion
      ).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Sin fecha';

  // ==========================================
  // DATOS DEL CLIENTE
  // ==========================================

  const documentoTipo = String(
    pago.documento_tipo || ''
  ).trim();

  const documentoNumero = String(
    pago.documento_numero || ''
  ).trim();

  // ==========================================
  // DATOS DEL PRODUCTO
  // ==========================================

  const producto = String(
    pago.ultimo_producto_nombre || ''
  ).trim();

  const sku = String(
    pago.ultimo_producto_sku || ''
  ).trim();

  const cantidad = Math.max(
    1,
    Number(
      pago.cantidad_pendiente || 1
    )
  );

  const precioUnitario = Number(
    pago.ultimo_producto_precio || 0
  );

  const subtotalProducto =
    precioUnitario * cantidad;

  // ==========================================
  // DATOS DE ENTREGA
  // ==========================================

  const tipoEntrega = String(
    pago.tipo_entrega || ''
  )
    .trim()
    .toLowerCase();

  let modalidadTexto =
    'No especificada';

  if (tipoEntrega === 'recojo') {
    modalidadTexto =
      '🏪 Recojo en tienda';
  }

  if (tipoEntrega === 'lima') {
    modalidadTexto =
      '🛵 Delivery en Lima';
  }

  if (tipoEntrega === 'provincia') {
    modalidadTexto =
      '📦 Envío a provincia';
  }

  const direccion = String(
    pago.direccion || ''
  ).trim();

  const referencia = String(
    pago.referencia || ''
  ).trim();

  const distrito = String(
    pago.distrito || ''
  ).trim();

  const ciudad = String(
    pago.ciudad || ''
  ).trim();

  const departamento = String(
    pago.departamento || ''
  ).trim();

  const agencia = String(
    pago.agencia || ''
  ).trim();

  // ==========================================
  // TOTAL DE LA COMPRA
  // ==========================================

  const totalPedido = Number(
    pago.total_pedido ||
    pago.monto ||
    0
  );

  // ==========================================
  // TARJETA
  // ==========================================

  return `
    <article
      class="pago-card"
      data-pago-id="${Number(pago.id)}"
    >

      <div class="pago-datos">

        <h3>
          ${escapeHtml(
            pago.cliente_nombre ||
            'Cliente WhatsApp'
          )}
        </h3>


        <!-- ============================= -->
        <!-- DATOS DEL CLIENTE -->
        <!-- ============================= -->

        <div class="pago-seccion">

          <strong>
            👤 DATOS DEL CLIENTE
          </strong>

          <p>
            📱 ${escapeHtml(
              pago.telefono || ''
            )}
          </p>

          ${
            documentoNumero
              ? `
                <p>
                  🪪 ${escapeHtml(
                    documentoTipo ||
                    'Documento'
                  )}:
                  <strong>
                    ${escapeHtml(
                      documentoNumero
                    )}
                  </strong>
                </p>
              `
              : ''
          }

        </div>


        <!-- ============================= -->
        <!-- DETALLE DEL PRODUCTO -->
        <!-- ============================= -->

        ${
          producto
            ? `
              <div class="pago-seccion">

                <strong>
                  🛒 DETALLE DEL PRODUCTO
                </strong>

                <p>
                  📦
                  <strong>
                    ${escapeHtml(
                      producto
                    )}
                  </strong>
                </p>

                ${
                  sku
                    ? `
                      <p>
                        🔖 SKU:
                        <strong>
                          ${escapeHtml(
                            sku
                          )}
                        </strong>
                      </p>
                    `
                    : ''
                }

                ${
                  cantidad > 0
                    ? `
                      <p>
                        📦 Cantidad:
                        <strong>
                          ${cantidad}
                        </strong>
                      </p>
                    `
                    : ''
                }

                ${
                  precioUnitario > 0
                    ? `
                      <p>
                        💰 Precio unitario:
                        <strong>
                          S/ ${precioUnitario.toFixed(2)}
                        </strong>
                      </p>
                    `
                    : ''
                }

                ${
                  subtotalProducto > 0
                    ? `
                      <p>
                        🧾 Subtotal:
                        <strong>
                          S/ ${subtotalProducto.toFixed(2)}
                        </strong>
                      </p>
                    `
                    : ''
                }

              </div>
            `
            : ''
        }


        <!-- ============================= -->
        <!-- ENTREGA -->
        <!-- ============================= -->

        <div class="pago-seccion">

          <strong>
            🚚 ENTREGA
          </strong>

          <p>
            ${modalidadTexto}
          </p>

          ${
            direccion
              ? `
                <p>
                  📍 Dirección:
                  <strong>
                    ${escapeHtml(
                      direccion
                    )}
                  </strong>
                </p>
              `
              : ''
          }

          ${
            referencia
              ? `
                <p>
                  📌 Referencia:
                  ${escapeHtml(
                    referencia
                  )}
                </p>
              `
              : ''
          }

          ${
            distrito
              ? `
                <p>
                  📍 Distrito:
                  <strong>
                    ${escapeHtml(
                      distrito
                    )}
                  </strong>
                </p>
              `
              : ''
          }

          ${
            ciudad || departamento
              ? `
                <p>
                  🌎 ${
                    [
                      ciudad,
                      departamento
                    ]
                      .filter(Boolean)
                      .map(escapeHtml)
                      .join(' - ')
                  }
                </p>
              `
              : ''
          }

          ${
            agencia
              ? `
                <p>
                  🏢 Agencia:
                  <strong>
                    ${escapeHtml(
                      agencia
                    )}
                  </strong>
                </p>
              `
              : ''
          }

        </div>


        <!-- ============================= -->
        <!-- RESUMEN DEL PAGO -->
        <!-- ============================= -->

        <div
          class="pago-seccion pago-resumen"
        >

          <strong>
            💰 RESUMEN DEL PAGO
          </strong>

          <p>
            Monto esperado:
            <strong>
              S/ ${totalPedido.toFixed(2)}
            </strong>
          </p>

          <p>
            💳 Medio:
            <strong>
              ${escapeHtml(
                pago.medio_pago ||
                'No especificado'
              )}
            </strong>
          </p>

          <p>
            🕘 ${escapeHtml(fecha)}
          </p>

        </div>

      </div>


      <!-- ============================= -->
      <!-- COMPROBANTE -->
      <!-- ============================= -->

      <div class="pago-comprobante">
        ${comprobanteHtml}
      </div>

 

<div class="pago-acciones">
 

  <div class="pago-metodo-confirmado">

    <label
      for="medioPagoConfirmado-${Number(
        pago.id
      )}"
    >
      <i class="fa-solid fa-wallet"></i>
      Medio confirmado por Caja
    </label>

    <select
      id="medioPagoConfirmado-${Number(
        pago.id
      )}"
      class="select-medio-pago-caja"
    >

      <option value="">
        Seleccionar método...
      </option>

      <option value="yape">
        Yape
      </option>

      <option value="plin">
        Plin
      </option>

      <option value="transferencia">
        Transferencia bancaria
      </option>

      <option value="tarjeta_pos">
        Tarjeta / POS
      </option>

      <option value="efectivo">
        Efectivo
      </option>

      <option value="deposito">
        Depósito bancario
      </option>

      <option value="otro">
        Otro
      </option>

    </select>

    <small class="pago-metodo-ayuda">
      Selecciona el medio que Caja verificó
      realmente en el comprobante.
    </small>

  </div>


  <!-- ============================= -->
  <!-- APROBAR -->
  <!-- ============================= -->

  <button
    type="button"
    class="btn-aprobar-pago"
    onclick="aprobarPago(${Number(
      pago.id
    )})"
  >
    <i
      class="fa-solid fa-check"
    ></i>

    Aprobar y crear pedido
  </button>


  <!-- ============================= -->
  <!-- RECHAZAR -->
  <!-- ============================= -->

  <button
    type="button"
    class="btn-rechazar-pago"
    onclick="rechazarPago(${Number(
      pago.id
    )})"
  >
    <i
      class="fa-solid fa-xmark"
    ></i>

    Rechazar
  </button>

</div>
    </article>
  `;
}
async function aprobarPago(pagoId) {

  const select =
    document.getElementById(
      `medioPagoConfirmado-${pagoId}`
    );


  const medioPagoConfirmado =
    String(
      select?.value || ''
    ).trim();


  if (!medioPagoConfirmado) {

    alert(
      'Selecciona el medio de pago confirmado por Caja.'
    );

    select?.focus();

    return;
  }


  const confirmar =
    window.confirm(
      `¿Confirmas que el pago fue realizado mediante ${etiquetaMedioPago(
        medioPagoConfirmado
      )} y que el comprobante es correcto?`
    );


  if (!confirmar) {
    return;
  }


  try {

    const res =
      await fetch(
        `/api/pagos/${pagoId}/aprobar`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            medio_pago_confirmado:
              medioPagoConfirmado
          })
        }
      );


    const data =
      await res.json();


    if (!res.ok || !data.ok) {

      throw new Error(
        data.error ||
        'No se pudo aprobar el pago.'
      );
    }


    if (data.pedido_codigo) {

      alert(
        `Pago aprobado correctamente.\n\nPedido creado: ${data.pedido_codigo}`
      );

    } else {

      alert(
        'Pago aprobado correctamente.'
      );
    }


    await Promise.all([
      cargarPagosPendientes(),
      cargarPedidosFacturacion()
    ]);


  } catch (error) {

    console.error(
      'ERROR APROBANDO PAGO:',
      error
    );


    alert(
      error.message ||
      'No se pudo aprobar el pago.'
    );
  }
}


window.aprobarPago =
  aprobarPago;

async function rechazarPago(pagoId) {
  const observacion = window.prompt(
    'Indica el motivo del rechazo:'
  );

  if (!observacion?.trim()) {
    return;
  }

  try {
    const res = await fetch(
      `/api/pagos/${pagoId}/rechazar`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          observacion:
            observacion.trim()
        })
      }
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        'No se pudo rechazar el pago.'
      );
    }

    alert(
      'El comprobante fue rechazado. El cliente será notificado.'
    );

    await cargarPagosPendientes();

  } catch (error) {
    console.error(
      'ERROR RECHAZANDO PAGO:',
      error
    );

    alert(
      error.message ||
      'No se pudo rechazar el pago.'
    );
  }
}

window.rechazarPago = rechazarPago;
// =======================================
// CARGAR PEDIDOS PARA FACTURACIÓN
// =======================================

async function cargarPedidosFacturacion() {

  if (!listaPedidosFacturacion) {
    return;
  }


  listaPedidosFacturacion.innerHTML = `
    <div class="estado-busqueda">
      <i class="fa-solid fa-spinner fa-spin"></i>
      Cargando pedidos...
    </div>
  `;


  try {

    const res =
      await fetch(
        '/api/pedidos'
      );


    const contentType =
      res.headers.get(
        'content-type'
      ) || '';


    if (
      !contentType.includes(
        'application/json'
      )
    ) {
      throw new Error(
        `El servidor respondió incorrectamente. Estado: ${res.status}`
      );
    }


    const data =
      await res.json();


    if (!res.ok || !data.ok) {

      throw new Error(
        data.error ||
        'No se pudieron cargar los pedidos.'
      );
    }


    pedidosFacturacionActuales =
      Array.isArray(
        data.pedidos
      )
        ? data.pedidos
        : [];


  actualizarResumenCaja();

actualizarContadoresPedidos();

renderizarPedidosFacturacion();


  } catch (error) {

    console.error(
      'ERROR CARGANDO PEDIDOS:',
      error
    );


    listaPedidosFacturacion.innerHTML = `
      <div class="estado-busqueda error">
        ${escapeHtml(
          error.message ||
          'No se pudieron cargar los pedidos.'
        )}
      </div>
    `;
  }
}

// =======================================
// RENDERIZAR PEDIDOS
// =======================================

// =======================================
// RENDERIZAR PEDIDOS
// =======================================

function renderizarPedidosFacturacion() {

    if (!listaPedidosFacturacion) {
        return;
    }


    const textoBusqueda =
        String(
            buscarPedidoCaja?.value ||
            ''
        )
            .trim()
            .toLowerCase();


    // ===================================
    // 1. FILTRAR POR ESTADO
    // ===================================

    let pedidos =
        pedidosFacturacionActuales.filter(
            pedido => {

                const facturado =
                    pedidoEstaFacturado(
                        pedido
                    );


                if (
                    filtroFacturacionActual ===
                    'facturados'
                ) {

                    return facturado;

                }


                return !facturado;

            }
        );


    // ===================================
    // 2. FILTRAR POR BUSCADOR
    // ===================================

    if (textoBusqueda) {

        pedidos =
            pedidos.filter(
                pedido => {

                    const contenido = [

                        pedido.codigo,

                        pedido.cliente_nombre,

                        pedido.telefono,

                        pedido.numero_documento,

                        pedido.distrito,

                        pedido.ciudad,

                        pedido.departamento,

                        pedido.medio_pago_confirmado

                    ]
                        .join(' ')
                        .toLowerCase();


                    return contenido.includes(
                        textoBusqueda
                    );

                }
            );

    }


    // ===================================
    // SIN RESULTADOS
    // ===================================

    if (!pedidos.length) {

        const esFacturados =
            filtroFacturacionActual ===
            'facturados';


        listaPedidosFacturacion.innerHTML = `

            <div class="sin-pagos">

                <div class="sin-pagos-icono">

                    <i class="fa-solid ${
                        esFacturados
                            ? 'fa-file-circle-check'
                            : 'fa-box-open'
                    }"></i>

                </div>


                <strong>

                    ${
                        esFacturados
                            ? 'No hay pedidos facturados'
                            : 'No hay pedidos pendientes de facturación'
                    }

                </strong>


                <span>

                    ${
                        esFacturados
                            ? 'Los pedidos facturados aparecerán aquí.'
                            : 'Los pagos aprobados pendientes de facturación aparecerán aquí.'
                    }

                </span>

            </div>

        `;

        return;
    }


    // ===================================
    // MOSTRAR PEDIDOS
    // ===================================

    listaPedidosFacturacion.innerHTML =
        pedidos
            .map(
                crearTarjetaPedido
            )
            .join('');

}
// =======================================
// CAMBIAR FILTRO FACTURACIÓN
// =======================================

function cambiarFiltroFacturacion(
    filtro
) {

    filtroFacturacionActual =
        filtro;


    btnPedidosPendientes
        ?.classList
        .toggle(
            'activo',
            filtro === 'pendientes'
        );


    btnPedidosFacturados
        ?.classList
        .toggle(
            'activo',
            filtro === 'facturados'
        );


    renderizarPedidosFacturacion();

}
// =======================================
// CREAR TARJETA DE PEDIDO
// =======================================

function crearTarjetaPedido(pedido) {

  const items =
    Array.isArray(
      pedido.items
    )
      ? pedido.items
      : [];


  const subtotal =
    numeroMoneda(
      pedido.subtotal_productos
    );


  const costoDelivery =
    numeroMoneda(
      pedido.costo_delivery
    );


  const total =
    numeroMoneda(
      pedido.total
    );


  const estadoFacturacion =
    String(
      pedido.estado_facturacion ||
      'pendiente'
    )
      .trim()
      .toLowerCase();


  const correo =
    String(
      pedido.correo || ''
    ).trim();


  const facturaPdf =
    String(
      pedido.factura_pdf_url ||
      ''
    ).trim();


  const facturaXml =
    String(
      pedido.factura_xml_url ||
      ''
    ).trim();


  let claseEstado =
    'pendiente';

  let textoEstado =
    'Pendiente de facturación';


  if (
    estadoFacturacion ===
    'cargado'
  ) {

    claseEstado =
      'cargado';

    textoEstado =
      'Comprobante cargado';
  }


  if (
    estadoFacturacion ===
    'enviado'
  ) {

    claseEstado =
      'completado';

    textoEstado =
      'Facturado y enviado';
  }


  const productosHtml =
    items.length

      ? items
          .map(item => {

            const cantidad =
              Number(
                item.cantidad || 1
              );


            const precio =
              numeroMoneda(
                item.precio_unitario
              );


            const subtotalItem =
              numeroMoneda(
                item.subtotal
              );


            return `
              <div class="pedido-item">

                <div class="pedido-item-info">

                  <strong>
                    ${escapeHtml(
                      item.nombre_producto ||
                      'Producto'
                    )}
                  </strong>

                  ${
                    item.sku
                      ? `
                        <small>
                          SKU:
                          ${escapeHtml(
                            item.sku
                          )}
                        </small>
                      `
                      : ''
                  }

                </div>


                <div class="pedido-item-precio">

                  <span>
                    ${cantidad}
                    ×
                    S/ ${precio.toFixed(2)}
                  </span>

                  <strong>
                    S/ ${subtotalItem.toFixed(2)}
                  </strong>

                </div>

              </div>
            `;
          })
          .join('')

      : `
          <div class="pago-info-vacia">
            Sin detalle de productos.
          </div>
        `;


  const ubicacion = [

    pedido.distrito,

    pedido.ciudad,

    pedido.departamento

  ]
    .filter(Boolean)
    .join(' - ');


  return `

    <article
      class="pedido-card"
      data-pedido-id="${Number(
        pedido.id
      )}"
    >

      <header
        class="pedido-card-header"
      >

        <div>

          <span
            class="pedido-codigo"
          >
            ${escapeHtml(
              pedido.codigo ||
              `PED-${pedido.id}`
            )}
          </span>

          <h3>
            ${escapeHtml(
              pedido.cliente_nombre ||
              'Cliente'
            )}
          </h3>

        </div>


        <span
          class="estado-facturacion ${claseEstado}"
        >
          ${escapeHtml(
            textoEstado
          )}
        </span>

      </header>


      <div
        class="pedido-card-grid"
      >


        <!-- CLIENTE -->

        <section
          class="pedido-bloque"
        >

          <strong
            class="pedido-bloque-titulo"
          >
            <i
              class="fa-solid fa-user"
            ></i>

            Cliente y entrega
          </strong>


          <p>
            <span>
              Teléfono
            </span>

            <b>
              ${escapeHtml(
                pedido.telefono ||
                ''
              )}
            </b>
          </p>


          ${
            pedido.numero_documento
              ? `
                <p>

                  <span>
                    ${escapeHtml(
                      pedido.tipo_documento ||
                      'Documento'
                    )}
                  </span>

                  <b>
                    ${escapeHtml(
                      pedido.numero_documento
                    )}
                  </b>

                </p>
              `
              : ''
          }


          <p>

            <span>
              Modalidad
            </span>

            <b>
              ${escapeHtml(
                etiquetaTipoEntrega(
                  pedido.tipo_entrega
                )
              )}
            </b>

          </p>


          ${
            pedido.direccion
              ? `
                <div
                  class="pedido-direccion"
                >

                  <i
                    class="fa-solid fa-location-dot"
                  ></i>

                  <div>

                    <strong>
                      ${escapeHtml(
                        pedido.direccion
                      )}
                    </strong>

                    ${
                      ubicacion
                        ? `
                          <small>
                            ${escapeHtml(
                              ubicacion
                            )}
                          </small>
                        `
                        : ''
                    }

                    ${
                      pedido.referencia
                        ? `
                          <small>
                            Referencia:
                            ${escapeHtml(
                              pedido.referencia
                            )}
                          </small>
                        `
                        : ''
                    }

                  </div>

                </div>
              `
              : ''
          }


          ${
            pedido.agencia
              ? `
                <p>

                  <span>
                    Agencia
                  </span>

                  <b>
                    ${escapeHtml(
                      pedido.agencia
                    )}
                  </b>

                </p>
              `
              : ''
          }

        </section>


        <!-- PRODUCTOS -->

        <section
          class="pedido-bloque pedido-productos"
        >

          <strong
            class="pedido-bloque-titulo"
          >
            <i
              class="fa-solid fa-boxes-stacked"
            ></i>

            Productos
          </strong>


          <div
            class="pedido-items-lista"
          >
            ${productosHtml}
          </div>


          <div
            class="pedido-resumen-total"
          >

            <span>
              Subtotal:

              <b>
                S/ ${subtotal.toFixed(2)}
              </b>
            </span>


            <span>
              Delivery:

              <b>
                S/ ${costoDelivery.toFixed(2)}
              </b>
            </span>


            <strong>
              TOTAL:
              S/ ${total.toFixed(2)}
            </strong>

          </div>


          <div
            class="pedido-pago-confirmado"
          >

            <i
              class="fa-solid fa-circle-check"
            ></i>

            Pago confirmado:

            <b>
              ${escapeHtml(
                etiquetaMedioPago(
                  pedido.medio_pago_confirmado
                )
              )}
            </b>

          </div>

        </section>


        <!-- FACTURACIÓN -->

        <section
          class="pedido-bloque pedido-facturacion"
        >

          <strong
            class="pedido-bloque-titulo"
          >

            <i
              class="fa-solid fa-file-invoice"
            ></i>

            Facturación

          </strong>


          <label>

            Correo del cliente

            <input
              type="email"
              id="correoPedido-${Number(
                pedido.id
              )}"
              value="${escapeHtml(
                correo
              )}"
              placeholder="cliente@correo.com"
            >

          </label>


          <label>

            Tipo de comprobante

            <select
              id="tipoComprobantePedido-${Number(
                pedido.id
              )}"
            >

              <option
                value="boleta"
                ${
                  String(
                    pedido.tipo_comprobante ||
                    'boleta'
                  ).toLowerCase() ===
                  'boleta'
                    ? 'selected'
                    : ''
                }
              >
                Boleta
              </option>

              <option
                value="factura"
                ${
                  String(
                    pedido.tipo_comprobante ||
                    ''
                  ).toLowerCase() ===
                  'factura'
                    ? 'selected'
                    : ''
                }
              >
                Factura
              </option>

            </select>

          </label>


          <div
            class="pedido-archivos"
          >

            <label
              class="archivo-factura"
            >

              <span>
                <i
                  class="fa-regular fa-file-pdf"
                ></i>
                PDF
              </span>

              <input
                type="file"
                id="pdfPedido-${Number(
                  pedido.id
                )}"
                accept=".pdf,application/pdf"
              >

            </label>


            <label
              class="archivo-factura"
            >

              <span>
                <i
                  class="fa-regular fa-file-code"
                ></i>
                XML
              </span>

              <input
                type="file"
                id="xmlPedido-${Number(
                  pedido.id
                )}"
                accept=".xml,text/xml,application/xml"
              >

            </label>

          </div>


          ${
            facturaPdf ||
            facturaXml
              ? `
                <div
                  class="pedido-documentos-guardados"
                >

                  ${
                    facturaPdf
                      ? `
                        <a
                          href="${escapeHtml(
                            facturaPdf
                          )}"
                          target="_blank"
                        >
                          <i
                            class="fa-regular fa-file-pdf"
                          ></i>

                          PDF guardado
                        </a>
                      `
                      : ''
                  }


                  ${
                    facturaXml
                      ? `
                        <a
                          href="${escapeHtml(
                            facturaXml
                          )}"
                          target="_blank"
                        >
                          <i
                            class="fa-regular fa-file-code"
                          ></i>

                          XML guardado
                        </a>
                      `
                      : ''
                  }

                </div>
              `
              : ''
          }


          <button
            type="button"
            class="btn-facturar-pedido"
            onclick="guardarFacturacionPedido(${Number(
              pedido.id
            )})"
          >

            <i
              class="fa-solid fa-cloud-arrow-up"
            ></i>

            Guardar y enviar por correo

          </button>


          <div
            class="pedido-acciones-secundarias"
          >

            <button
              type="button"
              onclick="descargarEtiquetaPedido(${Number(
                pedido.id
              )})"
            >

              <i
                class="fa-solid fa-tag"
              ></i>

              Descargar etiqueta

            </button>


            ${
              facturaPdf ||
              facturaXml
                ? `
                  <button
                    type="button"
                    onclick="reenviarCorreoPedido(${Number(
                      pedido.id
                    )})"
                  >

                    <i
                      class="fa-solid fa-envelope"
                    ></i>

                    Reenviar correo

                  </button>
                `
                : ''
            }

          </div>

        </section>

      </div>

    </article>
  `;
}
// =======================================
// GUARDAR FACTURACIÓN
// =======================================

async function guardarFacturacionPedido(
  pedidoId
) {

  const correo =
    String(
      document
        .getElementById(
          `correoPedido-${pedidoId}`
        )
        ?.value || ''
    ).trim();


  const tipoComprobante =
    String(
      document
        .getElementById(
          `tipoComprobantePedido-${pedidoId}`
        )
        ?.value ||
        'boleta'
    ).trim();


  const pdf =
    document
      .getElementById(
        `pdfPedido-${pedidoId}`
      )
      ?.files?.[0] ||
    null;


  const xml =
    document
      .getElementById(
        `xmlPedido-${pedidoId}`
      )
      ?.files?.[0] ||
    null;


  if (!correo) {

    alert(
      'Ingresa el correo del cliente.'
    );

    return;
  }


  const pedido =
    pedidosFacturacionActuales.find(
      item =>
        Number(item.id) ===
        Number(pedidoId)
    );


  if (
    !pdf &&
    !xml &&
    !pedido?.factura_pdf_url &&
    !pedido?.factura_xml_url
  ) {

    alert(
      'Carga al menos el PDF o XML del comprobante.'
    );

    return;
  }


  const formData =
    new FormData();


  formData.append(
    'correo',
    correo
  );


  formData.append(
    'tipo_comprobante',
    tipoComprobante
  );


  if (pdf) {
    formData.append(
      'pdf',
      pdf
    );
  }


  if (xml) {
    formData.append(
      'xml',
      xml
    );
  }


  try {

    const res =
      await fetch(
        `/api/pedidos/${pedidoId}/facturacion`,
        {
          method:
            'POST',

          body:
            formData
        }
      );


    const data =
      await res.json();


    if (!res.ok || !data.ok) {

      throw new Error(
        data.error ||
        'No se pudo guardar la facturación.'
      );
    }


    if (data.correo_enviado) {

      alert(
        'Facturación guardada y enviada correctamente al correo.'
      );

    } else {

      alert(
        data.aviso_correo ||
        'Facturación guardada, pero el correo todavía no fue enviado.'
      );
    }


    await cargarPedidosFacturacion();


  } catch (error) {

    console.error(
      'ERROR GUARDANDO FACTURACIÓN:',
      error
    );


    alert(
      error.message ||
      'No se pudo guardar la facturación.'
    );
  }
}


window.guardarFacturacionPedido =
  guardarFacturacionPedido;

  // =======================================
// REENVIAR COMPROBANTE
// =======================================

async function reenviarCorreoPedido(
  pedidoId
) {

  const correo =
    String(
      document
        .getElementById(
          `correoPedido-${pedidoId}`
        )
        ?.value ||
        ''
    ).trim();


  if (!correo) {

    alert(
      'Ingresa el correo del cliente.'
    );

    return;
  }


  try {

    const res =
      await fetch(
        `/api/pedidos/${pedidoId}/enviar-correo`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              correo
            })
        }
      );


    const data =
      await res.json();


    if (!res.ok || !data.ok) {

      throw new Error(
        data.error ||
        'No se pudo enviar el correo.'
      );
    }


    alert(
      `Comprobante enviado correctamente a:\n${correo}`
    );


    await cargarPedidosFacturacion();


  } catch (error) {

    console.error(
      'ERROR REENVIANDO CORREO:',
      error
    );


    alert(
      error.message ||
      'No se pudo enviar el correo.'
    );
  }
}


window.reenviarCorreoPedido =
  reenviarCorreoPedido;

  // =======================================
// DESCARGAR ETIQUETA
// =======================================

function descargarEtiquetaPedido(
  pedidoId
) {

  window.open(
    `/api/pedidos/${pedidoId}/etiqueta.pdf`,
    '_blank'
  );
}


window.descargarEtiquetaPedido =
  descargarEtiquetaPedido;
  // =======================================
// EVENTOS DE CAJA Y FACTURACIÓN
// =======================================

tabCajaPagos?.addEventListener(
  'click',
  () => {
    cambiarTabCaja(
      'pagos'
    );
  }
);


tabCajaPedidos?.addEventListener(
  'click',
  () => {
    cambiarTabCaja(
      'pedidos'
    );
  }
);


btnActualizarPedidos?.addEventListener(
  'click',
  cargarPedidosFacturacion
);


buscarPedidoCaja?.addEventListener(
  'input',
  renderizarPedidosFacturacion
);

// =======================================
// BOTÓN PENDIENTES
// =======================================

btnPedidosPendientes
    ?.addEventListener(
        'click',
        () => {

            cambiarFiltroFacturacion(
                'pendientes'
            );

        }
    );


// =======================================
// BOTÓN FACTURADOS
// =======================================

btnPedidosFacturados
    ?.addEventListener(
        'click',
        () => {

            cambiarFiltroFacturacion(
                'facturados'
            );

        }
    );
 // =======================================
// ABRIR VISTA CAJA Y FACTURACIÓN
// =======================================

 
function mostrarVistaCaja(
    tab = 'pagos'
) {

    // Cerrar menú principal
    if (
        typeof cerrarAjustes ===
        'function'
    ) {
        cerrarAjustes();
    }


    // Primero cerrar todas las vistas
    ocultarTodasLasVistasPrincipales();


    // Mostrar solamente CAJA
    vistaCaja
        ?.classList.remove(
            'oculto'
        );


    // Botón activo
    btnVistaCaja
        ?.classList.add(
            'activo'
        );


    // Mostrar pestaña de Caja
    cambiarTabCaja(
        tab
    );
}
// =======================================
// BOTÓN CAJA DEL MENÚ LATERAL
// =======================================

if (btnVistaCaja) {

  btnVistaCaja.addEventListener(
    'click',
    async () => {

      const rol =
        String(
          usuarioLogueado?.rol ||
          ''
        )
          .trim()
          .toLowerCase();


      if (
        ![
          'admin',
          'caja'
        ].includes(
          rol
        ) &&
        !tienePermiso(
          'pagos',
          'ver'
        )
      ) {

        alert(
          'No tienes permiso para acceder a Caja.'
        );

        return;
      }


      mostrarVistaCaja(
        'pagos'
      );


      await Promise.all([
        cargarPagosPendientes(),
        cargarPedidosFacturacion()
      ]);

    }
  );
}


// =======================================
// VERIFICACIÓN DE PAGOS DESDE AJUSTES
// =======================================

if (btnModuloPagos) {

  btnModuloPagos.addEventListener(
    'click',
    async () => {

      const rol =
        String(
          usuarioLogueado?.rol ||
          ''
        )
          .trim()
          .toLowerCase();


      if (
        ![
          'admin',
          'caja'
        ].includes(
          rol
        ) &&
        !tienePermiso(
          'pagos',
          'ver'
        )
      ) {

        alert(
          'No tienes permiso para verificar pagos.'
        );

        return;
      }


      // Cerrar panel de ajustes
      cerrarAjustes();


      // Abrir Caja directamente
      mostrarVistaCaja(
        'pagos'
      );


      // Actualizar ambas listas
      await Promise.all([
        cargarPagosPendientes(),
        cargarPedidosFacturacion()
      ]);

    }
  );
}


// =======================================
// PESTAÑAS DE CAJA
// =======================================

tabCajaPagos?.addEventListener(
  'click',
  () => {

    cambiarTabCaja(
      'pagos'
    );

  }
);


tabCajaPedidos?.addEventListener(
  'click',
  () => {

    cambiarTabCaja(
      'pedidos'
    );

  }
);


// =======================================
// ACTUALIZAR PAGOS
// =======================================

btnActualizarPagos?.addEventListener(
  'click',
  cargarPagosPendientes
);


// =======================================
// ACTUALIZAR PEDIDOS
// =======================================

btnActualizarPedidos?.addEventListener(
  'click',
  cargarPedidosFacturacion
);


// =======================================
// BUSCAR PEDIDO
// =======================================

buscarPedidoCaja?.addEventListener(
  'input',
  renderizarPedidosFacturacion
);
function actualizarCamposNuevoUsuario() {
  if (!nuevoRol || !configAsignacionNuevo) return;

  configAsignacionNuevo.style.display =
    nuevoRol.value === 'asesor' ? 'block' : 'none';
}

if (nuevoRol && configAsignacionNuevo) {
  nuevoRol.addEventListener(
    'change',
    actualizarCamposNuevoUsuario
  );

  actualizarCamposNuevoUsuario();
}

const editRol = document.getElementById('editRol');

const configAsignacionEditar =
  document.getElementById('configAsignacionEditar');

function actualizarCamposEditarUsuario() {
  if (!editRol || !configAsignacionEditar) return;

  configAsignacionEditar.style.display =
    editRol.value === 'asesor' ? 'block' : 'none';
}

if (editRol && configAsignacionEditar) {
  editRol.addEventListener(
    'change',
    actualizarCamposEditarUsuario
  );

  actualizarCamposEditarUsuario();
}


// =======================================
// PANEL DE AJUSTES
// =======================================
// =======================================
// PANEL DE AJUSTES
// =======================================
function abrirPanelAjustes() {

  if (!panelAjustes) {
    return;
  }


  panelAjustes.classList.add(
    'abierto'
  );


  panelAjustes.setAttribute(
    'aria-hidden',
    'false'
  );


  btnConfiguracion?.setAttribute(
    'aria-expanded',
    'true'
  );


  fondoPanelAjustes?.classList.add(
    'mostrar'
  );


  document.body.classList.add(
    'panel-ajustes-abierto'
  );
}
function cerrarAjustes() {

  if (!panelAjustes) {
    return;
  }


  // Si el foco quedó dentro del panel,
  // moverlo fuera antes de ocultarlo.
  if (
    panelAjustes.contains(
      document.activeElement
    )
  ) {

    btnConfiguracion?.focus();

  }


  panelAjustes.classList.remove(
    'abierto'
  );


  panelAjustes.setAttribute(
    'aria-hidden',
    'true'
  );


  btnConfiguracion?.setAttribute(
    'aria-expanded',
    'false'
  );


  fondoPanelAjustes?.classList.remove(
    'mostrar'
  );


  document.body.classList.remove(
    'panel-ajustes-abierto'
  );
}

btnConfiguracion?.addEventListener(
  'click',
  event => {
    event.stopPropagation();
    abrirPanelAjustes();
  }
);

cerrarPanelAjustes?.addEventListener(
  'click',
  cerrarAjustes
);

fondoPanelAjustes?.addEventListener(
  'click',
  cerrarAjustes
);

document.addEventListener(
  'keydown',
  event => {
    if (event.key === 'Escape') {
      cerrarAjustes();
    }
  }
);
// =======================================
// CERRAR MENÚ DESPUÉS DE ELEGIR OPCIÓN
// =======================================

panelAjustes?.addEventListener(
  'click',
  event => {

    const opcion =
      event.target.closest(
        '[data-cerrar-menu="true"]'
      );


    if (!opcion) {
      return;
    }


    cerrarAjustes();

  }
);

  const ETAPAS_EMBUDO = [
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

const ETIQUETAS_ETAPAS = {
  LEADS_ENTRANTES: 'LEADS ENTRANTES',
  ERROR_REORGANIZAR: 'ERROR (REORGANIZAR)',
  MENU: 'MENÚ',
  RECIBE_INFORMACION: 'RECIBE INFORMACIÓN',
  CLIENTES_ESCRIBEN_NUEVAMENTE: 'CLIENTES ESCRIBEN NUEVAMENTE',
  ATENDER_LEAD: 'ATENDER LEAD',
  ATENDIDOS: 'ATENDIDOS',
  INTERESADOS: 'INTERESADOS',
  VISITARA_TIENDA: 'VISITARÁ TIENDA',
  VALIDAR_PAGO: 'VALIDAR PAGO',
  PAGO_CONFIRMADO: 'PAGO CONFIRMADO',
  PAGO_NO_CONFIRMADO: 'PAGO NO CONFIRMADO',
  ENVIAR_COMPROBANTE_ATENDER: 'ENVIAR COMPROBANTE - ATENDER',
  DESPACHO: 'DESPACHO',
  VENTA_GANADA: 'VENTA GANADA',
  VENTA_PERDIDA: 'VENTA PERDIDA'
};

let leadsEmbudo = [];

const btnVistaEmbudo = document.getElementById('btnVistaEmbudo');
const btnVistaChats = document.getElementById('btnVistaChats');
const vistaEmbudo = document.getElementById('vistaEmbudo');
const kanbanEmbudo = document.getElementById('kanbanEmbudo');
const btnActualizarEmbudo = document.getElementById('btnActualizarEmbudo');
const buscarLeadEmbudo = document.getElementById('buscarLeadEmbudo');


// =======================================
// CERRAR TODAS LAS VISTAS PRINCIPALES
// =======================================

function ocultarTodasLasVistasPrincipales() {

    // CHAT
    document
        .getElementById('panelChatsSidebar')
        ?.classList.add('oculto');

    document
        .getElementById('panelChat')
        ?.classList.add('oculto');


    // EMBUDO
    vistaEmbudo
        ?.classList.add('oculto');


    // SEGUIMIENTOS
    vistaSeguimientos
        ?.classList.add('oculto');


    // CAJA
    vistaCaja
        ?.classList.add('oculto');


    // ===================================
    // QUITAR BOTONES ACTIVOS
    // ===================================

    btnVistaChats
        ?.classList.remove('activo');

    btnVistaEmbudo
        ?.classList.remove('activo');

    btnVistaSeguimientos
        ?.classList.remove('activo');

    btnVistaCaja
        ?.classList.remove('activo');
}

async function cargarEmbudo() {
  try {
    const res = await fetch('/api/embudo');
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'No se pudo cargar el embudo');
    }

 leadsEmbudo =
  Array.isArray(data)
    ? data
    : [];

cargarAsesoresEmbudo();
renderizarEmbudo();

  } catch (error) {
    console.error('ERROR CARGAR EMBUDO:', error);
    if (kanbanEmbudo) {
      kanbanEmbudo.innerHTML = `
        <div class="estado-busqueda error">
          Error al cargar embudo
        </div>
      `;
    }
  }
}

 
function renderizarEmbudo() {
  if (!kanbanEmbudo) return;

  const texto = String(
    buscarLeadEmbudo?.value || ''
  )
    .trim()
    .toLowerCase();

  const asesorSeleccionado = String(
    filtroAsesorEmbudo?.value || ''
  );

  const ahora = new Date();

  const leadsFiltrados =
    leadsEmbudo.filter(lead => {
      const contenido = [
        lead.nombre,
        lead.telefono,
        lead.asesor_nombre,
        lead.ultimo_mensaje
      ]
        .join(' ')
        .toLowerCase();

      const coincideTexto =
        !texto ||
        contenido.includes(texto);

      const coincideAsesor =
        !asesorSeleccionado ||
        String(lead.asesor_id || '') ===
          asesorSeleccionado;

      const tieneSeguimiento =
        Number(lead.tiene_seguimiento) === 1;

      const fechaSeguimiento =
        lead.fecha_seguimiento
          ? new Date(lead.fecha_seguimiento)
          : null;

      const seguimientoVencido =
        tieneSeguimiento &&
        fechaSeguimiento &&
        fechaSeguimiento < ahora;

      let coincideFiltro = true;

      if (filtroEmbudoActual === 'mios') {
        coincideFiltro =
          Number(lead.asesor_id) ===
          Number(usuarioLogueado?.id);
      }

      if (
        filtroEmbudoActual ===
        'con_tarea'
      ) {
        coincideFiltro =
          tieneSeguimiento;
      }

      if (
        filtroEmbudoActual ===
        'vencidos'
      ) {
        coincideFiltro =
          seguimientoVencido;
      }

      if (
        filtroEmbudoActual ===
        'activos'
      ) {
        coincideFiltro =
          ![
            'VENTA_GANADA',
            'VENTA_PERDIDA'
          ].includes(
            lead.etapa_embudo
          );
      }

      return (
        coincideTexto &&
        coincideAsesor &&
        coincideFiltro
      );
    });

  const totalMonto =
    leadsFiltrados.reduce(
      (total, lead) =>
        total +
        Number(
          lead.monto_estimado || 0
        ),
      0
    );

  if (resumenEmbudo) {
    resumenEmbudo.textContent =
      `${leadsFiltrados.length} leads · ` +
      `S/ ${totalMonto.toFixed(2)}`;
  }

  kanbanEmbudo.innerHTML = '';

  ETAPAS_EMBUDO.forEach(etapa => {
    const leadsEtapa =
      leadsFiltrados.filter(
        lead =>
          String(
            lead.etapa_embudo ||
            'LEADS_ENTRANTES'
          ) === etapa
      );

    const columna =
      document.createElement('div');

    columna.className =
      'columna-embudo';

    columna.dataset.etapa =
      etapa;

    columna.innerHTML = `
      <div class="columna-header">
        <h3>
          ${
            ETIQUETAS_ETAPAS[etapa] ||
            etapa
          }
        </h3>

        <p>
          ${leadsEtapa.length}
          cliente${
            leadsEtapa.length === 1
              ? ''
              : 's'
          } potencial${
            leadsEtapa.length === 1
              ? ''
              : 'es'
          }
        </p>
      </div>

      <div class="columna-body"></div>
    `;

    const body =
      columna.querySelector(
        '.columna-body'
      );

    body.addEventListener(
      'dragover',
      event => {
        event.preventDefault();

        body.classList.add(
          'drop-hover'
        );
      }
    );

    body.addEventListener(
      'dragleave',
      () => {
        body.classList.remove(
          'drop-hover'
        );
      }
    );

    body.addEventListener(
      'drop',
      async event => {
        event.preventDefault();

        body.classList.remove(
          'drop-hover'
        );

        const leadId =
          event.dataTransfer.getData(
            'text/plain'
          );

        if (!leadId) return;

        await moverLeadDeEtapa(
          leadId,
          etapa
        );
      }
    );

    leadsEtapa.forEach(lead => {
      body.appendChild(
        crearTarjetaLead(lead)
      );
    });

    kanbanEmbudo.appendChild(
      columna
    );
  });
}
function formatearSeguimientoLead(
  lead
) {
  if (!lead.fecha_seguimiento) {
    return '● Tiene seguimiento';
  }

  const fecha =
    new Date(
      lead.fecha_seguimiento
    );

  const vencido =
    fecha < new Date();

  const fechaTexto =
    fecha.toLocaleString(
      'es-PE',
      {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  return vencido
    ? `⚠ Vencido: ${fechaTexto}`
    : `📅 ${fechaTexto}`;
}
function crearTarjetaLead(lead) {
  const card = document.createElement('div');

  card.className = 'tarjeta-lead';
  card.draggable = true;
  card.dataset.id = String(lead.id);
  card.dataset.arrastrando = '0';

  const fecha = lead.fecha_actualizacion
    ? new Date(
        lead.fecha_actualizacion
      ).toLocaleDateString('es-PE')
    : 'Sin fecha';

  card.innerHTML = `
    <strong>
      ${escapeHtml(
        lead.nombre ||
        'Cliente WhatsApp'
      )}
    </strong>

    <div class="telefono">
      ${escapeHtml(
        lead.telefono || ''
      )}
    </div>

    <div class="asesor">
      Asesor:
      ${escapeHtml(
        lead.asesor_nombre ||
        'Sin asesor'
      )}
    </div>

    <div class="fecha">
      ${escapeHtml(fecha)}
    </div>

    <div class="ultimo-msg">
      ${escapeHtml(
        String(
          lead.ultimo_mensaje || ''
        ).slice(0, 80)
      )}
    </div>

   <button
  type="button"
  class="tarea tarea-lead-btn ${
    Number(lead.tiene_seguimiento) === 1
      ? 'con-tarea'
      : ''
  }"
>
  ${
    Number(lead.tiene_seguimiento) === 1
      ? formatearSeguimientoLead(lead)
      : '＋ Programar seguimiento'
  }
</button>
  `;

const botonTarea =
  card.querySelector(
    '.tarea-lead-btn'
  );

botonTarea?.addEventListener(
  'click',
  event => {
    event.stopPropagation();

    abrirModalNuevoSeguimiento(
      lead
    );
  }
);

  card.addEventListener(
    'dragstart',
    event => {
      card.dataset.arrastrando = '1';

      card.classList.add(
        'arrastrando'
      );

      event.dataTransfer.effectAllowed =
        'move';

      event.dataTransfer.setData(
        'text/plain',
        String(lead.id)
      );
    }
  );

  card.addEventListener(
    'dragend',
    () => {
      card.classList.remove(
        'arrastrando'
      );

      setTimeout(() => {
        card.dataset.arrastrando = '0';
      }, 150);
    }
  );

  card.addEventListener(
    'click',
    async () => {
      if (
        card.dataset.arrastrando === '1'
      ) {
        return;
      }

      let cliente = clientes.find(
        item =>
          Number(item.id) ===
          Number(lead.id)
      );

      /*
       * Si todavía no está en la lista local,
       * actualizamos los clientes.
       */
      if (!cliente) {
        await cargarClientes();

        cliente = clientes.find(
          item =>
            Number(item.id) ===
            Number(lead.id)
        );
      }

      if (!cliente) {
        alert(
          'No se encontró la conversación de este cliente.'
        );
        return;
      }

      mostrarVistaChats();

      await abrirChat(cliente);
    }
  );

  return card;
}

async function moverLeadDeEtapa(clienteId, nuevaEtapa) {
  try {
    const res = await fetch(`/api/clientes/${clienteId}/etapa`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etapa_embudo: nuevaEtapa
      })
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se pudo mover el lead');
    }

    const lead = leadsEmbudo.find(x => Number(x.id) === Number(clienteId));
    if (lead) {
      lead.etapa_embudo = nuevaEtapa;
    }

    renderizarEmbudo();
    await cargarClientes();

  } catch (error) {
    console.error('ERROR MOVIENDO LEAD:', error);
    alert(error.message || 'No se pudo mover el lead');
  }
}

if (btnActualizarEmbudo) {
  btnActualizarEmbudo.addEventListener('click', cargarEmbudo);
}

if (buscarLeadEmbudo) {
  buscarLeadEmbudo.addEventListener('input', renderizarEmbudo);
}

function mostrarVistaChats() {

    // Cerrar menú principal si está abierto
    if (
        typeof cerrarAjustes ===
        'function'
    ) {
        cerrarAjustes();
    }


    // Primero cerrar absolutamente todo
    ocultarTodasLasVistasPrincipales();


    // Mostrar únicamente CHAT
    document
        .getElementById(
            'panelChatsSidebar'
        )
        ?.classList.remove(
            'oculto'
        );


    document
        .getElementById(
            'panelChat'
        )
        ?.classList.remove(
            'oculto'
        );


    // Marcar botón activo
    btnVistaChats
        ?.classList.add(
            'activo'
        );
}

function mostrarVistaEmbudo() {

    // Cerrar menú principal
    if (
        typeof cerrarAjustes ===
        'function'
    ) {
        cerrarAjustes();
    }


    // Cerrar todas las vistas
    ocultarTodasLasVistasPrincipales();


    // Mostrar solamente EMBUDO
    vistaEmbudo
        ?.classList.remove(
            'oculto'
        );


    // Botón activo
    btnVistaEmbudo
        ?.classList.add(
            'activo'
        );
}

if (btnVistaEmbudo) {
  btnVistaEmbudo.addEventListener(
    'click',
    async () => {
      mostrarVistaEmbudo();

      await cargarEmbudo();
    }
  );
}

if (btnVistaChats) {
  btnVistaChats.addEventListener(
    'click',
    mostrarVistaChats
  );
}

// =======================================
// ABRIR MODAL DE SEGUIMIENTO
// =======================================

function abrirModalNuevoSeguimiento(
  lead = null
) {
  if (!modalSeguimiento) {
    console.error(
      'No existe #modalSeguimiento en el HTML'
    );
    return;
  }

  const cliente =
    lead || clienteActual;

  if (!cliente) {
    alert(
      'Selecciona un cliente primero.'
    );
    return;
  }

  formSeguimiento?.reset();

  if (seguimientoClienteId) {
    seguimientoClienteId.value =
      cliente.id;
  }

  if (seguimientoClienteNombre) {
    seguimientoClienteNombre.value =
      cliente.nombre ||
      cliente.telefono ||
      'Cliente WhatsApp';
  }

  if (seguimientoPrioridad) {
    seguimientoPrioridad.value =
      'media';
  }

  const fechaPredeterminada =
    new Date(
      Date.now() +
      24 * 60 * 60 * 1000
    );

  if (seguimientoFecha) {
    seguimientoFecha.value =
      convertirFechaInput(
        fechaPredeterminada
      );
  }

  if (seguimientoAsesor) {
    seguimientoAsesor.value =
      usuarioLogueado?.nombre || '';
  }

  modalSeguimiento.classList.add(
    'mostrar'
  );

  seguimientoTitulo?.focus();
}

function convertirFechaInput(fecha) {
  const local = new Date(
    fecha.getTime() -
    fecha.getTimezoneOffset() *
    60000
  );

  return local
    .toISOString()
    .slice(0, 16);
}
// =======================================
// GUARDAR SEGUIMIENTO
// =======================================

formSeguimiento?.addEventListener(
  'submit',
  async event => {
    event.preventDefault();

    const clienteId = Number(
      seguimientoClienteId?.value
    );

    const titulo = String(
      seguimientoTitulo?.value || ''
    ).trim();

    const fechaProgramada = String(
      seguimientoFecha?.value || ''
    ).trim();

    if (!clienteId) {
      alert(
        'No se seleccionó un cliente.'
      );
      return;
    }

    if (!titulo) {
      alert(
        'Escribe el motivo del seguimiento.'
      );

      seguimientoTitulo?.focus();
      return;
    }
   
    if (!fechaProgramada) {
      alert(
        'Selecciona la fecha y hora.'
      );

      seguimientoFecha?.focus();
      return;
    }

    const botonGuardar =
      formSeguimiento.querySelector(
        'button[type="submit"]'
      );

    if (botonGuardar) {
      botonGuardar.disabled = true;
      botonGuardar.textContent =
        'Guardando...';
    }

    try {
      const res = await fetch(
        '/api/seguimientos',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            cliente_id: clienteId,
            titulo,
            nota: String(
              seguimientoNota?.value || ''
            ).trim(),
            prioridad:
              seguimientoPrioridad?.value ||
              'media',
            fecha_programada:
              fechaProgramada,
            asesor_id:
              usuarioLogueado?.id ||
              null,
            asesor_nombre:
              usuarioLogueado?.nombre ||
              null
          })
        }
      );

      const contentType =
        res.headers.get(
          'content-type'
        ) || '';

      if (
        !contentType.includes(
          'application/json'
        )
      ) {
        throw new Error(
          `El servidor respondió con formato incorrecto. Estado: ${res.status}`
        );
      }

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
          'No se pudo crear el seguimiento.'
        );
      }

      modalSeguimiento.classList.remove(
        'mostrar'
      );

      formSeguimiento.reset();

      await cargarEmbudo();

      if (
        vistaSeguimientos &&
        !vistaSeguimientos.classList.contains(
          'oculto'
        )
      ) {
        await cargarSeguimientos();
      }

      alert(
        'Seguimiento registrado correctamente.'
      );

    } catch (error) {
      console.error(
        'ERROR GUARDANDO SEGUIMIENTO:',
        error
      );

      alert(
        error.message ||
        'No se pudo guardar.'
      );

    } finally {
      if (botonGuardar) {
        botonGuardar.disabled = false;
        botonGuardar.textContent =
          'Guardar seguimiento';
      }
    }
  }
);

// =======================================
// EVENTOS DEL MODAL DE SEGUIMIENTO
// =======================================

cerrarModalSeguimiento?.addEventListener(
  'click',
  () => {
    modalSeguimiento?.classList.remove(
      'mostrar'
    );
  }
);

modalSeguimiento?.addEventListener(
  'click',
  event => {
    if (
      event.target === modalSeguimiento
    ) {
      modalSeguimiento.classList.remove(
        'mostrar'
      );
    }
  }
);

btnNuevoSeguimiento?.addEventListener(
  'click',
  () => {
    abrirModalNuevoSeguimiento(
      clienteActual
    );
  }
);

// =======================================
// FILTROS DEL EMBUDO
// =======================================

filtrosEmbudo.forEach(boton => {
  boton.addEventListener(
    'click',
    () => {
      filtrosEmbudo.forEach(
        item => {
          item.classList.remove(
            'activo'
          );
        }
      );

      boton.classList.add(
        'activo'
      );

      filtroEmbudoActual =
        boton.dataset.filtroEmbudo ||
        'activos';

      renderizarEmbudo();
    }
  );
});

// =======================================
// FILTRO DE ASESORES
// =======================================

function cargarAsesoresEmbudo() {
  if (!filtroAsesorEmbudo) return;

  const asesores = new Map();

  leadsEmbudo.forEach(lead => {
    if (
      lead.asesor_id &&
      lead.asesor_nombre
    ) {
      asesores.set(
        String(lead.asesor_id),
        lead.asesor_nombre
      );
    }
  });

  const valorActual =
    filtroAsesorEmbudo.value;

  filtroAsesorEmbudo.innerHTML = `
    <option value="">
      Todos los asesores
    </option>
  `;

  asesores.forEach(
    (nombre, id) => {
      const opcion =
        document.createElement(
          'option'
        );

      opcion.value = id;
      opcion.textContent = nombre;

      filtroAsesorEmbudo.appendChild(
        opcion
      );
    }
  );

  const existeValor =
    [...filtroAsesorEmbudo.options]
      .some(
        opcion =>
          opcion.value ===
          valorActual
      );

  filtroAsesorEmbudo.value =
    existeValor
      ? valorActual
      : '';
}

filtroAsesorEmbudo?.addEventListener(
  'change',
  renderizarEmbudo
);

// =======================================
// CARGAR SEGUIMIENTOS
// =======================================

async function cargarSeguimientos() {
  if (!listaSeguimientos) return;

  listaSeguimientos.innerHTML = `
    <div class="estado-busqueda">
      Cargando seguimientos...
    </div>
  `;

  try {
    const res = await fetch(
      '/api/seguimientos'
    );

    const contentType =
      res.headers.get(
        'content-type'
      ) || '';

    if (
      !contentType.includes(
        'application/json'
      )
    ) {
      throw new Error(
        `El servidor respondió con formato incorrecto. Estado: ${res.status}`
      );
    }

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        'No se pudieron cargar los seguimientos.'
      );
    }

    seguimientosComerciales =
      Array.isArray(
        data.seguimientos
      )
        ? data.seguimientos
        : [];

    pintarSeguimientos();

  } catch (error) {
    console.error(
      'ERROR CARGANDO SEGUIMIENTOS:',
      error
    );

    listaSeguimientos.innerHTML = `
      <div class="estado-busqueda error">
        ${escapeHtml(
          error.message ||
          'No se pudieron cargar los seguimientos.'
        )}
      </div>
    `;
  }
}
function pintarSeguimientos() {
  if (!listaSeguimientos) return;

  if (
    !seguimientosComerciales.length
  ) {
    listaSeguimientos.innerHTML = `
      <div class="estado-busqueda">
        No hay seguimientos registrados.
      </div>
    `;

    return;
  }

  listaSeguimientos.innerHTML =
    seguimientosComerciales
      .map(item => {
        const fecha = new Date(
          item.fecha_programada
        );

        const fechaValida =
          !Number.isNaN(
            fecha.getTime()
          );

        const vencido =
          item.estado ===
            'pendiente' &&
          fechaValida &&
          fecha < new Date();

        const fechaTexto =
          fechaValida
            ? fecha.toLocaleString(
                'es-PE',
                {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              )
            : 'Sin fecha';

        return `
          <article
            class="seguimiento-card ${
              vencido
                ? 'vencido'
                : ''
            }"
          >
            <div class="seguimiento-info">
              <strong>
                ${escapeHtml(
                  item.cliente_nombre ||
                  'Cliente'
                )}
              </strong>

              <p>
                ${escapeHtml(
                  item.titulo ||
                  'Seguimiento'
                )}
              </p>

              ${
                item.nota
                  ? `
                    <p class="seguimiento-nota">
                      ${escapeHtml(
                        item.nota
                      )}
                    </p>
                  `
                  : ''
              }

              <small>
                📅 ${escapeHtml(
                  fechaTexto
                )}
              </small>

              <small>
                👤 ${escapeHtml(
                  item.asesor_nombre ||
                  'Sin asignar'
                )}
              </small>

              <small>
                Prioridad:
                ${escapeHtml(
                  item.prioridad ||
                  'media'
                )}
              </small>
            </div>

            <div class="seguimiento-acciones">
              ${
                item.estado ===
                'pendiente'
                  ? `
                    <button
                      type="button"
                      onclick="completarSeguimiento(${Number(item.id)})"
                    >
                      ✅ Completar
                    </button>
                  `
                  : `
                    <span class="seguimiento-completado">
                      ✅ Completado
                    </span>
                  `
              }
            </div>
          </article>
        `;
      })
      .join('');
}
async function completarSeguimiento(
  seguimientoId
) {
  const confirmar = window.confirm(
    '¿Marcar este seguimiento como completado?'
  );

  if (!confirmar) return;

  try {
    const res = await fetch(
      `/api/seguimientos/${seguimientoId}/completar`,
      {
        method: 'PATCH'
      }
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        'No se pudo completar.'
      );
    }

    await cargarSeguimientos();
    await cargarEmbudo();

  } catch (error) {
    console.error(
      'ERROR COMPLETANDO SEGUIMIENTO:',
      error
    );

    alert(
      error.message ||
      'No se pudo completar.'
    );
  }
}

window.completarSeguimiento =
  completarSeguimiento;

  // =======================================
// CAMBIO DE VISTA: SEGUIMIENTOS
// =======================================

function mostrarVistaSeguimientos() {

    // Cerrar menú principal
    if (
        typeof cerrarAjustes ===
        'function'
    ) {
        cerrarAjustes();
    }


    // Cerrar todo
    ocultarTodasLasVistasPrincipales();


    // Mostrar solamente SEGUIMIENTOS
    vistaSeguimientos
        ?.classList.remove(
            'oculto'
        );


    // Botón activo
    btnVistaSeguimientos
        ?.classList.add(
            'activo'
        );
}

btnVistaSeguimientos?.addEventListener(
  'click',
  async () => {
    mostrarVistaSeguimientos();
    await cargarSeguimientos();
  }
);

btnActualizarSeguimientos?.addEventListener(
  'click',
  cargarSeguimientos
);

// =======================================
// PANEL DE PERMISOS DE USUARIOS
// =======================================

const btnAbrirPermisosUsuarios =
  document.getElementById(
    'btnAbrirPermisosUsuarios'
  );

const btnConfigurarPermisosUsuario =
  document.getElementById(
    'btnConfigurarPermisosUsuario'
  );

const modalPermisosUsuarios =
  document.getElementById(
    'modalPermisosUsuarios'
  );

const cerrarModalPermisos =
  document.getElementById(
    'cerrarModalPermisos'
  );

const guardarPermisosUsuario =
  document.getElementById(
    'guardarPermisosUsuario'
  );

const buscarUsuarioPermisos =
  document.getElementById(
    'buscarUsuarioPermisos'
  );

const listaUsuariosPermisos =
  document.getElementById(
    'listaUsuariosPermisos'
  );

const permisosUsuarioId =
  document.getElementById(
    'permisosUsuarioId'
  );

const permisosUsuarioRol =
  document.getElementById(
    'permisosUsuarioRol'
  );

const perfilPermisosSeleccionado =
  document.getElementById(
    'perfilPermisosSeleccionado'
  );

const permisosUsuarioNombre =
  document.getElementById(
    'permisosUsuarioNombre'
  );

const permisosUsuarioRolTexto =
  document.getElementById(
    'permisosUsuarioRolTexto'
  );

const tituloPanelPermisos =
  document.getElementById(
    'tituloPanelPermisos'
  );

const subtituloPanelPermisos =
  document.getElementById(
    'subtituloPanelPermisos'
  );

const estadoGuardadoPermisos =
  document.getElementById(
    'estadoGuardadoPermisos'
  );

const selectoresPermisos =
  document.querySelectorAll(
    '.permiso-select'
  );

const botonesPerfilPermisos =
  document.querySelectorAll(
    '[data-perfil-permisos]'
  );

// =======================================
// PLANTILLAS DE PERMISOS
// =======================================

const perfilesPermisosCRM = {
  administrador: {
    nivelGeneral: 'permitido'
  },

  ventas: {
    chats: {
      ver: 'equipo',
      editar: 'responsable',
      tomar: 'permitido',
      finalizar: 'responsable',
      volver_bot: 'responsable'
    },

    embudo: {
      ver: 'equipo',
      crear: 'permitido',
      editar: 'responsable',
      mover: 'responsable',
      eliminar: 'denegado',
      exportar: 'denegado'
    },

    seguimientos: {
      ver: 'equipo',
      crear: 'permitido',
      editar: 'responsable',
      completar: 'responsable',
      eliminar: 'denegado'
    },

    clientes: {
      ver: 'equipo',
      editar: 'responsable',
      exportar: 'denegado'
    },

    pagos: {
      ver: 'denegado',
      aprobar: 'denegado',
      rechazar: 'denegado'
    },

    respuestas_rapidas: {
      ver: 'permitido',
      crear: 'denegado',
      editar: 'denegado',
      eliminar: 'denegado'
    },

    reportes: {
      ver: 'denegado',
      exportar: 'denegado'
    },

    usuarios: {
      ver: 'denegado',
      crear: 'denegado',
      editar: 'denegado',
      eliminar: 'denegado',
      cambiar_clave: 'denegado',
      permisos: 'denegado'
    },

    auditoria: {
      ver: 'denegado'
    }
  },

  contabilidad: {
    chats: {
      ver: 'equipo',
      editar: 'denegado',
      tomar: 'denegado',
      finalizar: 'denegado',
      volver_bot: 'denegado'
    },

    embudo: {
      ver: 'equipo',
      crear: 'denegado',
      editar: 'denegado',
      mover: 'denegado',
      eliminar: 'denegado',
      exportar: 'permitido'
    },

    seguimientos: {
      ver: 'equipo',
      crear: 'denegado',
      editar: 'denegado',
      completar: 'denegado',
      eliminar: 'denegado'
    },

    clientes: {
      ver: 'equipo',
      editar: 'denegado',
      exportar: 'permitido'
    },

    pagos: {
      ver: 'permitido',
      aprobar: 'permitido',
      rechazar: 'permitido'
    },

    respuestas_rapidas: {
      ver: 'denegado',
      crear: 'denegado',
      editar: 'denegado',
      eliminar: 'denegado'
    },

    reportes: {
      ver: 'permitido',
      exportar: 'permitido'
    },

    usuarios: {
      ver: 'denegado',
      crear: 'denegado',
      editar: 'denegado',
      eliminar: 'denegado',
      cambiar_clave: 'denegado',
      permisos: 'denegado'
    },

    auditoria: {
      ver: 'denegado'
    }
  },

  propios: {
    nivelGeneral: 'propios'
  }
};

// =======================================
// ABRIR Y CERRAR MODAL
// =======================================

function mostrarModalPermisos() {
  if (!modalPermisosUsuarios) {
    alert(
      'No se encontró el panel de permisos en el HTML.'
    );

    return;
  }

  modalPermisosUsuarios.classList.add(
    'mostrar'
  );

  modalPermisosUsuarios.setAttribute(
    'aria-hidden',
    'false'
  );

  document.body.style.overflow = 'hidden';

  renderizarUsuariosPermisos(
    usuariosRegistrados
  );
}

function ocultarModalPermisos() {
  if (!modalPermisosUsuarios) {
    return;
  }

  modalPermisosUsuarios.classList.remove(
    'mostrar'
  );

  modalPermisosUsuarios.setAttribute(
    'aria-hidden',
    'true'
  );

  document.body.style.overflow = '';
}

// =======================================
// RENDERIZAR USUARIOS
// =======================================

function obtenerInicialesPermisos(nombre) {
  return String(nombre || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(parte => parte.charAt(0))
    .join('')
    .toUpperCase();
}

function renderizarUsuariosPermisos(
  lista = usuariosRegistrados
) {
  if (!listaUsuariosPermisos) {
    return;
  }

  const usuarios = Array.isArray(lista)
    ? lista
    : [];

  if (!usuarios.length) {
    listaUsuariosPermisos.innerHTML = `
      <div class="estado-busqueda">
        No se encontraron usuarios.
      </div>
    `;

    return;
  }

  listaUsuariosPermisos.innerHTML =
    usuarios.map(usuario => `
      <button
        type="button"
        class="usuario-permisos-item"
        data-usuario-permisos-id="${usuario.id}"
      >
        <span class="usuario-permisos-avatar">
          ${obtenerInicialesPermisos(
            usuario.nombre
          )}
        </span>

        <span>
          <strong>
            ${escapeHtml(
              usuario.nombre || 'Usuario'
            )}
          </strong>

          <small>
            @${escapeHtml(
              usuario.usuario || ''
            )}
          </small>
        </span>

        <span class="usuario-permisos-rol">
          ${escapeHtml(
            usuario.rol || ''
          )}
        </span>
      </button>
    `).join('');

  listaUsuariosPermisos
    .querySelectorAll(
      '.usuario-permisos-item'
    )
    .forEach(boton => {
      boton.addEventListener(
        'click',
        () => {
          abrirPanelPermisosUsuario(
            boton.dataset
              .usuarioPermisosId
          );
        }
      );
    });
}

// =======================================
// LEER Y PINTAR MATRIZ
// =======================================

function leerMatrizPermisos() {
  const permisos = {};

  selectoresPermisos.forEach(select => {
    const modulo =
      select.dataset.modulo;

    const accion =
      select.dataset.accion;

    if (!modulo || !accion) {
      return;
    }

    if (!permisos[modulo]) {
      permisos[modulo] = {};
    }

    permisos[modulo][accion] =
      select.value || 'denegado';
  });

  return permisos;
}

function pintarMatrizPermisos(
  permisos = {}
) {
  selectoresPermisos.forEach(select => {
    const modulo =
      select.dataset.modulo;

    const accion =
      select.dataset.accion;

    const nivel =
      permisos?.[modulo]?.[accion] ||
      'denegado';

    select.value = nivel;
  });
}

function activarBotonPerfil(perfil) {
  botonesPerfilPermisos.forEach(
    boton => {
      boton.classList.toggle(
        'activo',
        boton.dataset
          .perfilPermisos === perfil
      );
    }
  );
}

// =======================================
// CARGAR PERMISOS DE UN USUARIO
// =======================================

async function abrirPanelPermisosUsuario(
  usuarioId
) {
  const id = Number(usuarioId);

  if (!id) {
    return;
  }

  const usuarioLocal =
    usuariosRegistrados.find(
      usuario =>
        Number(usuario.id) === id
    );

  permisosUsuarioId.value =
    String(id);

  if (usuarioLocal) {
    permisosUsuarioRol.value =
      usuarioLocal.rol || '';

    permisosUsuarioNombre.textContent =
      usuarioLocal.nombre ||
      'Usuario';

    permisosUsuarioRolTexto.textContent =
      usuarioLocal.rol || '-';

    tituloPanelPermisos.textContent =
      `Permisos de ${
        usuarioLocal.nombre ||
        'usuario'
      }`;
  }

  subtituloPanelPermisos.textContent =
    'Cargando configuración...';

  guardarPermisosUsuario.disabled =
    true;

  listaUsuariosPermisos
    ?.querySelectorAll(
      '.usuario-permisos-item'
    )
    .forEach(boton => {
      boton.classList.toggle(
        'activo',
        Number(
          boton.dataset
            .usuarioPermisosId
        ) === id
      );
    });

  try {
    const res = await fetch(
      `/api/usuarios/${id}/permisos`
    );

    const contentType =
      res.headers.get(
        'content-type'
      ) || '';

    if (
      !contentType.includes(
        'application/json'
      )
    ) {
      throw new Error(
        `El servidor respondió incorrectamente. Estado: ${res.status}`
      );
    }

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        'No se pudieron cargar los permisos.'
      );
    }

    const usuario =
      data.usuario || {};

    permisosUsuarioRol.value =
      usuario.rol || '';

    permisosUsuarioNombre.textContent =
      usuario.nombre ||
      'Usuario';

    permisosUsuarioRolTexto.textContent =
      usuario.rol || '-';

    tituloPanelPermisos.textContent =
      `Permisos de ${
        usuario.nombre ||
        'usuario'
      }`;

    const perfil =
      usuario.perfil_permisos ||
      'propios';

    perfilPermisosSeleccionado.value =
      perfil;

    pintarMatrizPermisos(
      normalizarPermisosFrontend(
        usuario.permisos
      )
    );

    activarBotonPerfil(perfil);

    subtituloPanelPermisos.textContent =
      'Configura qué módulos puede ver y qué acciones puede realizar.';

    guardarPermisosUsuario.disabled =
      false;

  } catch (error) {
    console.error(
      'ERROR CARGANDO PERMISOS DEL USUARIO:',
      error
    );

    subtituloPanelPermisos.textContent =
      error.message;

    pintarMatrizPermisos({});

    guardarPermisosUsuario.disabled =
      false;
  }
}

window.abrirPanelPermisosUsuario =
  abrirPanelPermisosUsuario;

// =======================================
// APLICAR PLANTILLA
// =======================================

function aplicarPerfilPermisos(perfil) {
  const plantilla =
    perfilesPermisosCRM[perfil];

  if (!plantilla) {
    return;
  }

  perfilPermisosSeleccionado.value =
    perfil;

  activarBotonPerfil(perfil);

  if (plantilla.nivelGeneral) {
    selectoresPermisos.forEach(select => {
      select.value =
        plantilla.nivelGeneral;
    });

    return;
  }

  selectoresPermisos.forEach(select => {
    const modulo =
      select.dataset.modulo;

    const accion =
      select.dataset.accion;

    select.value =
      plantilla?.[modulo]?.[accion] ||
      'denegado';
  });
}

botonesPerfilPermisos.forEach(
  boton => {
    boton.addEventListener(
      'click',
      () => {
        aplicarPerfilPermisos(
          boton.dataset
            .perfilPermisos
        );
      }
    );
  }
);

// =======================================
// GUARDAR PERMISOS
// =======================================

guardarPermisosUsuario?.addEventListener(
  'click',
  async () => {
    const usuarioId =
      Number(
        permisosUsuarioId?.value
      );

    if (!usuarioId) {
      alert(
        'Selecciona un usuario.'
      );

      return;
    }

    guardarPermisosUsuario.disabled =
      true;

    const textoAnterior =
      guardarPermisosUsuario.innerHTML;

    guardarPermisosUsuario.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Guardando...
    `;

    if (estadoGuardadoPermisos) {
      estadoGuardadoPermisos.textContent =
        'Guardando cambios...';
    }

    try {
      const res = await fetch(
        `/api/usuarios/${usuarioId}/permisos`,
        {
          method: 'PUT',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            perfil_permisos:
              perfilPermisosSeleccionado
                ?.value ||
              'personalizado',

            permisos:
              leerMatrizPermisos()
          })
        }
      );

      const contentType =
        res.headers.get(
          'content-type'
        ) || '';

      if (
        !contentType.includes(
          'application/json'
        )
      ) {
        throw new Error(
          `El servidor respondió incorrectamente. Estado: ${res.status}`
        );
      }

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
          'No se pudieron guardar los permisos.'
        );
      }

      if (estadoGuardadoPermisos) {
        estadoGuardadoPermisos
          .textContent =
          'Permisos guardados correctamente.';
      }

      alert(
        'Permisos guardados correctamente.'
      );

    } catch (error) {
      console.error(
        'ERROR GUARDANDO PERMISOS:',
        error
      );

      if (estadoGuardadoPermisos) {
        estadoGuardadoPermisos
          .textContent =
          error.message;
      }

      alert(error.message);

    } finally {
      guardarPermisosUsuario.disabled =
        false;

      guardarPermisosUsuario.innerHTML =
        textoAnterior;
    }
  }
);

// =======================================
// EVENTOS PARA ABRIR Y CERRAR
// =======================================

btnAbrirPermisosUsuarios
  ?.addEventListener(
    'click',
    async () => {
      // Cierra el modal pequeño de usuarios.
      modalUsuariosRegistrados
        ?.classList.remove(
          'mostrar'
        );

      mostrarModalPermisos();

      if (
        !Array.isArray(
          usuariosRegistrados
        ) ||
        !usuariosRegistrados.length
      ) {
        await cargarUsuariosRegistrados();

        renderizarUsuariosPermisos(
          usuariosRegistrados
        );
      }
    }
  );

btnConfigurarPermisosUsuario
  ?.addEventListener(
    'click',
    () => {
      const usuarioId =
        Number(
          document.getElementById(
            'editId'
          )?.value
        );

      if (!usuarioId) {
        alert(
          'No se encontró el usuario seleccionado.'
        );

        return;
      }

      modalEditarUsuario
        ?.classList.remove(
          'mostrar'
        );

      mostrarModalPermisos();

      abrirPanelPermisosUsuario(
        usuarioId
      );
    }
  );

cerrarModalPermisos
  ?.addEventListener(
    'click',
    ocultarModalPermisos
  );

modalPermisosUsuarios
  ?.addEventListener(
    'click',
    event => {
      if (
        event.target ===
        modalPermisosUsuarios
      ) {
        ocultarModalPermisos();
      }
    }
  );

buscarUsuarioPermisos
  ?.addEventListener(
    'input',
    () => {
      const texto = String(
        buscarUsuarioPermisos.value ||
        ''
      )
        .trim()
        .toLowerCase();

      const filtrados =
        usuariosRegistrados.filter(
          usuario => {
            return [
              usuario.nombre,
              usuario.usuario,
              usuario.rol
            ]
              .join(' ')
              .toLowerCase()
              .includes(texto);
          }
        );

      renderizarUsuariosPermisos(
        filtrados
      );
    }
  );

document.addEventListener(
  'keydown',
  event => {
    if (
      event.key === 'Escape' &&
      modalPermisosUsuarios
        ?.classList.contains(
          'mostrar'
        )
    ) {
      ocultarModalPermisos();
    }
  }
);
cargarUsuarioActual();

async function abrirPanelPerfilCliente() {

  if (!clienteActual) {
    return;
  }


  try {

    panelPerfilCliente
      ?.classList.add(
        'abierto'
      );


    fondoPerfilCliente
      ?.classList.add(
        'mostrar'
      );


    const [
      respuestaPerfil,
      respuestaAsesores
    ] =
      await Promise.all([
        fetch(
          `/api/clientes/${clienteActual.id}/perfil`
        ),

        fetch(
          '/api/asesores'
        )
      ]);


    const data =
      await respuestaPerfil.json();


    const dataAsesores =
      await respuestaAsesores.json();


    if (
      !respuestaPerfil.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        'No se pudo cargar el perfil.'
      );

    }


    const cliente =
      data.cliente;


    // ==================================
    // ASESORES
    // ==================================

    perfilAsesor.innerHTML = `
      <option value="">
        Sin asesor
      </option>
    `;


    if (
      dataAsesores.ok &&
      Array.isArray(
        dataAsesores.asesores
      )
    ) {

      dataAsesores.asesores
        .forEach(
          asesor => {

            const opcion =
              document.createElement(
                'option'
              );


            opcion.value =
              asesor.id;


            opcion.textContent =
              asesor.nombre;


            perfilAsesor.appendChild(
              opcion
            );

          }
        );

    }


    // ==================================
    // DATOS PRINCIPALES
    // ==================================

    perfilNombre.value =
      cliente.nombre || '';


    perfilDocumentoTipo.value =
      cliente.documento_tipo || '';


    perfilDocumentoNumero.value =
      cliente.documento_numero || '';


    perfilTelefono.value =
      cliente.telefono || '';


    perfilCorreo.value =
      cliente.correo || '';


    perfilAsesor.value =
      cliente.asesor_id || '';


    perfilFechaIngreso.value =
      cliente.fecha_creacion
        ? new Date(
            cliente.fecha_creacion
          ).toLocaleString(
            'es-PE'
          )
        : '';


    // ==================================
    // FACTURACIÓN
    // ==================================

    perfilTipoComprobante.value =
      cliente.tipo_comprobante || '';


    perfilFacturacionNombre.value =
      cliente.facturacion_nombre || '';


    perfilFacturacionDocumentoTipo.value =
      cliente.facturacion_documento_tipo ||
      '';


    perfilFacturacionDocumentoNumero.value =
      cliente.facturacion_documento_numero ||
      '';


    // ==================================
    // ENVÍO
    // ==================================

    perfilDireccion.value =
      cliente.direccion || '';


    perfilDepartamento.value =
      cliente.departamento || '';


    perfilProvincia.value =
      cliente.provincia || '';


    perfilDistrito.value =
      cliente.distrito || '';


    perfilAgencia.value =
      cliente.agencia || '';


    perfilSede.value =
      cliente.sede || '';


  } catch (error) {

    console.error(
      'ERROR PERFIL CLIENTE:',
      error
    );


    alert(
      error.message
    );

  }

}

function cerrarPanelPerfilCliente() {

  panelPerfilCliente
    ?.classList.remove(
      'abierto'
    );


  fondoPerfilCliente
    ?.classList.remove(
      'mostrar'
    );

}


cerrarPerfilCliente
  ?.addEventListener(
    'click',
    cerrarPanelPerfilCliente
  );


fondoPerfilCliente
  ?.addEventListener(
    'click',
    cerrarPanelPerfilCliente
  );

  // =======================================
// ABRIR PERFIL AL HACER CLIC
// EN EL NOMBRE / AVATAR DEL CLIENTE
// =======================================

abrirPerfilCliente
  ?.addEventListener(
    'click',
    async () => {

      if (!clienteActual) {

        return;

      }

      await abrirPanelPerfilCliente();

    }
  );

  // =======================================
// GUARDAR PERFIL DEL CLIENTE
// =======================================

formPerfilCliente
  ?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (!clienteActual) {

        alert(
          'No hay un cliente seleccionado.'
        );

        return;

      }


      const boton =
        document.getElementById(
          'guardarPerfilCliente'
        );


      if (!boton) {
        return;
      }


      const contenidoAnterior =
        boton.innerHTML;


      boton.disabled =
        true;


      boton.innerHTML = `
        <i
          class="fa-solid fa-spinner fa-spin"
        ></i>
        Guardando...
      `;


      try {

        const res =
          await fetch(
            `/api/clientes/${clienteActual.id}/perfil`,
            {
              method:
                'PUT',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({

                  // =======================
                  // DATOS PRINCIPALES
                  // =======================

                  nombre:
                    String(
                      perfilNombre
                        ?.value || ''
                    ).trim(),

                  documento_tipo:
                    String(
                      perfilDocumentoTipo
                        ?.value || ''
                    ).trim(),

                  documento_numero:
                    String(
                      perfilDocumentoNumero
                        ?.value || ''
                    ).trim(),

                  correo:
                    String(
                      perfilCorreo
                        ?.value || ''
                    ).trim(),

                  asesor_id:
                    perfilAsesor
                      ?.value
                      ? Number(
                          perfilAsesor.value
                        )
                      : null,


                  // =======================
                  // FACTURACIÓN
                  // =======================

                  tipo_comprobante:
                    String(
                      perfilTipoComprobante
                        ?.value || ''
                    ).trim(),

                  facturacion_nombre:
                    String(
                      perfilFacturacionNombre
                        ?.value || ''
                    ).trim(),

                  facturacion_documento_tipo:
                    String(
                      perfilFacturacionDocumentoTipo
                        ?.value || ''
                    ).trim(),

                  facturacion_documento_numero:
                    String(
                      perfilFacturacionDocumentoNumero
                        ?.value || ''
                    ).trim(),


                  // =======================
                  // ENVÍO
                  // =======================

                  direccion:
                    String(
                      perfilDireccion
                        ?.value || ''
                    ).trim(),

                  departamento:
                    String(
                      perfilDepartamento
                        ?.value || ''
                    ).trim(),

                  provincia:
                    String(
                      perfilProvincia
                        ?.value || ''
                    ).trim(),

                  distrito:
                    String(
                      perfilDistrito
                        ?.value || ''
                    ).trim(),

                  agencia:
                    String(
                      perfilAgencia
                        ?.value || ''
                    ).trim(),

                  sede:
                    String(
                      perfilSede
                        ?.value || ''
                    ).trim()

                })
            }
          );


        const contentType =
          res.headers.get(
            'content-type'
          ) || '';


        if (
          !contentType.includes(
            'application/json'
          )
        ) {

          throw new Error(
            `El servidor respondió incorrectamente. Estado: ${res.status}`
          );

        }


        const data =
          await res.json();


        if (
          !res.ok ||
          !data.ok
        ) {

          throw new Error(
            data.error ||
            'No se pudo guardar el perfil.'
          );

        }


        // =================================
        // ACTUALIZAR NOMBRE EN CABECERA
        // =================================

        const nombreNuevo =
          String(
            perfilNombre
              ?.value || ''
          ).trim();


        clienteActual.nombre =
          nombreNuevo;


        clienteNombre.textContent =
          nombreNuevo ||
          'Cliente WhatsApp';


        // =================================
        // ACTUALIZAR ASESOR LOCAL
        // =================================

        clienteActual.asesor_id =
          data.asesor_id ??
          perfilAsesor?.value ??
          null;


        clienteActual.asesor_nombre =
          data.asesor_nombre ||
          clienteActual.asesor_nombre ||
          '';


        // =================================
        // ACTUALIZAR AVATAR
        // =================================

        const avatarHeader =
          document.getElementById(
            'avatarHeader'
          );


        if (avatarHeader) {

          const nombreAvatar =
            nombreNuevo ||
            clienteActual.telefono ||
            'ZR';


          avatarHeader.textContent =
            obtenerIniciales(
              nombreAvatar
            );


          avatarHeader.style.background =
            colorAvatar(
              nombreAvatar
            );

        }


        // =================================
        // RECARGAR BANDEJA
        // =================================

        await cargarClientes();


        // =================================
        // CERRAR PANEL
        // =================================

        cerrarPanelPerfilCliente();


        alert(
          'Perfil actualizado correctamente.'
        );


      } catch (error) {

        console.error(
          'ERROR GUARDANDO PERFIL:',
          error
        );


        alert(
          error.message ||
          'No se pudo guardar el perfil.'
        );


      } finally {

        boton.disabled =
          false;


        boton.innerHTML =
          contenidoAnterior;

      }

    }
  );