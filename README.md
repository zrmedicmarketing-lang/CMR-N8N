# CRM WhatsApp con Node.js + MySQL + HTML

CRM basico para ver clientes, chats de WhatsApp, estados y responder mensajes.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear base de datos

Importa el archivo `database.sql` en MySQL.

```bash
mysql -u root -p < database.sql
```

## 3. Configurar variables

Copia `.env.example` como `.env`:

```bash
cp .env.example .env
```

Edita los datos de MySQL y de tu API de WhatsApp.

## 4. Ejecutar

```bash
npm start
```

Abre:

```text
http://localhost:3000
```

## 5. Webhook para n8n

En n8n envia un POST a:

```text
http://TU_SERVIDOR:3000/webhook/whatsapp
```

Body JSON recomendado:

```json
{
  "nombre": "Juan Perez",
  "telefono": "51999999999",
  "mensaje": "Hola, quiero una cotizacion"
}
```

## Nota importante

El endpoint `/api/enviar` esta preparado para conectarse a tu API de WhatsApp. Debes adaptar `WHATSAPP_API_URL` y el body segun el proveedor que uses.
