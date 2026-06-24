[README.md](https://github.com/user-attachments/files/29310508/README.md)
# Dicharm Dance — Sistema Web de Inscripciones

Sitio web de inscripciones para **Dicharm Dance**, escuela de baile en Sant Boi de Llobregat (Barcelona).

Permite a los alumnos seleccionar clases, elegir forma de pago (tarjeta o transferencia) y completar su inscripción de forma autónoma. La gestión de alumnos se centraliza en Google Sheets.

---

## Estructura del proyecto

```
dicharm-dance-web/
├── index.html                          # Web principal (formulario de inscripción)
├── gracias.html                        # Página de confirmación tras pago con Stripe
├── netlify.toml                        # Configuración de Netlify
├── package.json                        # Dependencias (Stripe SDK)
├── google_apps_script.gs.txt           # Script de Google Sheets (copiar manualmente)
└── netlify/
    └── functions/
        ├── create-checkout.js          # Crea sesión de pago en Stripe
        ├── confirm-transfer.js         # Envía datos bancarios por email (transferencia)
        └── stripe-webhook.js           # Confirma pagos de Stripe y registra en Sheets
```

---

## Tecnologías utilizadas

| Capa | Herramienta |
|------|-------------|
| Hosting | [Netlify](https://netlify.com) (gratuito) |
| Pagos con tarjeta | [Stripe Checkout](https://stripe.com) |
| Emails transaccionales | [Resend](https://resend.com) |
| Base de datos de alumnos | Google Sheets + Google Apps Script |
| Backend (funciones) | Netlify Functions (Node.js) |

---

## Variables de entorno

Configurar en **Netlify → Site settings → Environment variables**:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook de Stripe | `whsec_...` |
| `RESEND_API_KEY` | Clave de la API de Resend | `re_...` |
| `SCHOOL_EMAIL_FROM` | Email remitente verificado en Resend | `info@dicharmdance.com` |
| `GOOGLE_SHEETS_WEBHOOK_URL` | URL del Google Apps Script desplegado | `https://script.google.com/...` |
| `BANK_HOLDER` | Titular de la cuenta bancaria | `Nombre Apellido` |
| `BANK_IBAN` | IBAN completo para transferencias | `ES00 0000 0000 0000 0000 0000` |
| `SITE_URL` | URL pública del sitio | `https://dicharmdance.netlify.app` |

> ⚠️ **Seguridad:** `BANK_HOLDER` y `BANK_IBAN` nunca se devuelven al navegador. Solo se usan dentro de las funciones del servidor para incluirlos en emails de confirmación.

---

## Flujo de inscripción

### Pago con tarjeta (Stripe)

```
Alumno rellena formulario
        ↓
create-checkout.js crea sesión en Stripe
        ↓
Alumno paga en la página de Stripe
        ↓
stripe-webhook.js recibe confirmación
        ↓
Alumno pasa a "Alumnos Activos" en Google Sheets
        ↓
Email de confirmación al alumno
```

### Pago por transferencia

```
Alumno rellena formulario y elige transferencia
        ↓
confirm-transfer.js envía email con IBAN e importe
        ↓
Alumno aparece en "Pendientes Transferencia" en Google Sheets
        ↓
Alumno realiza la transferencia manualmente
        ↓
Tú ves el ingreso en tu cuenta bancaria
        ↓
Cambias el Estado a "Confirmado" en Google Sheets
        ↓
El script envía email de confirmación al alumno
y mueve la fila a "Alumnos Activos" automáticamente
```

---

## Instalación y puesta en marcha

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "Primera versión Dicharm Dance"
git branch -M main
git remote add origin https://github.com/tu-usuario/dicharm-dance-web.git
git push -u origin main
```

### 2. Conectar con Netlify

1. Entra en [netlify.com](https://netlify.com) → *Add new site → Import from Git*
2. Selecciona tu repositorio de GitHub
3. Configuración de build: déjalo todo vacío (no hay proceso de compilación)
4. Clic en *Deploy site*
5. Ve a *Site settings → Environment variables* y añade todas las variables de la tabla anterior

### 3. Configurar el webhook de Stripe

1. En el [dashboard de Stripe](https://dashboard.stripe.com) → *Developers → Webhooks*
2. *Add endpoint* → URL: `https://tu-sitio.netlify.app/.netlify/functions/stripe-webhook`
3. Eventos a escuchar: `checkout.session.completed`
4. Copia el *Signing secret* (`whsec_...`) y ponlo en `STRIPE_WEBHOOK_SECRET` en Netlify

### 4. Configurar Google Apps Script

1. Abre el Google Sheet `Dicharm_Dance_Gestion_Clientes`
2. *Extensiones → Apps Script*
3. Borra el código por defecto y pega el contenido de `google_apps_script.gs.txt`
4. En el menú lateral, ve a **Activadores** (icono de reloj) y añade:
   - Función: `onEdit` | Evento: *Al editar* | Origen: *Desde la hoja de cálculo*
5. *Desplegar → Nueva implementación*
   - Tipo: *Aplicación web*
   - Ejecutar como: *Yo*
   - Acceso: *Cualquier usuario*
6. Copia la URL `/exec` generada → ponla en `GOOGLE_SHEETS_WEBHOOK_URL` en Netlify

> ⚠️ El activador de `onEdit` debe ser **instalable** (añadido manualmente en el panel de Activadores), no el automático, porque necesita permisos para enviar emails y modificar otras hojas.

### 5. Verificar el email en Resend

1. Entra en [resend.com](https://resend.com) → *Domains*
2. Añade y verifica tu dominio, o usa directamente `dicharmdance@gmail.com` si lo tienes verificado
3. Copia la API key en `RESEND_API_KEY`

---

## Hojas del Google Sheet

| Pestaña | Contenido |
|---------|-----------|
| `Alumnos Activos` | Alumnos con plaza confirmada |
| `Pendientes Transferencia` | Solicitudes pendientes de ingreso |
| `Pagos` | Registro histórico de cobros |

### Confirmar una transferencia

1. Ve a la pestaña **Pendientes Transferencia**
2. Cuando veas el ingreso en tu cuenta, cambia la celda de la columna **Estado** (J) de `Pendiente de pago` a `Confirmado`
3. El script envía automáticamente el email de confirmación al alumno y mueve la fila a Alumnos Activos

También puedes hacerlo desde el menú **Dicharm 💜** → *Enviar confirmación a seleccionado*.

---

## Hacer cambios en el sitio

Para cualquier modificación (textos, precios, horarios...):

1. Edita los archivos en tu ordenador
2. Guarda y sube a GitHub:
```bash
git add .
git commit -m "Descripción del cambio"
git push
```
3. Netlify detecta el push y republica el sitio automáticamente en 1-2 minutos.

---

## Precios y tarifa de clases

| Horas semanales | Precio/mes |
|-----------------|------------|
| 1h | 35€ |
| 2h | 60€ |
| 3h | 80€ |
| Cada hora adicional (+3h) | +20€ |

Los gastos de gestión de Stripe (1,5% + 0,25€) se calculan automáticamente y se añaden al total cuando el alumno elige pago con tarjeta. Las transferencias no tienen recargo.

---

## Contacto

**Dicharm Dance**
📍 Carrer d'Eusebi Güell 43, Sant Boi de Llobregat, Barcelona
📧 dicharmdance@gmail.com
💬 Instagram · TikTok · Facebook: @dicharmdance
