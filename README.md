# idk Mail - Backend

Backend API para el servicio de correo y chat privado idk Mail, construido con Node.js, Express y MongoDB.

## Tecnologías

- **Node.js** + **Express**: Framework del servidor
- **MongoDB** + **Mongoose**: Base de datos
- **Socket.io**: Comunicación en tiempo real para chat
- **JWT**: Autenticación segura
- **bcryptjs**: Hash de contraseñas
- **Multer**: Subida de archivos
- **cors**: Control de acceso CORS
- **express-validator**: Validación de datos

## Requisitos previos

1. **Node.js** (versión 18 o superior)
2. **MongoDB** (local o MongoDB Atlas)
3. (Opcional) Certificados SSL para HTTPS

## Instalación

```bash
cd backend
npm install
```

## Configuración

### Variables de entorno (opcional)
Crea un archivo `.env` en el directorio `backend`:

```env
MONGODB_URI=mongodb://localhost:27017/idk-mail
JWT_SECRET=tu-secreto-super-seguro-aqui
PORT=2053
CORS_ORIGIN=http://localhost:3000
```

### HTTPS (opcional)
Para usar HTTPS, coloca tus certificados en el directorio `certs/`:
- `server.cert`
- `server.key`

Si no hay certificados, el servidor usa HTTP por defecto.

## Ejecución

### Modo producción
```bash
npm start
```

### Modo desarrollo (con nodemon)
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:2053` (o `https://` si usas certificados)

## Estructura del proyecto

```
backend/
├── certs/               # Certificados SSL (opcional)
├── config/
│   └── database.js      # Conexión a MongoDB
├── middleware/
│   ├── auth.js          # Middleware de autenticación JWT
│   └── errorHandler.js  # Manejador de errores
├── models/              # Modelos de MongoDB
│   ├── User.js
│   ├── Mail.js
│   ├── FriendRequest.js
│   ├── PublicMessage.js
│   └── PrivateMessage.js
├── routes/              # Rutas de la API
│   ├── auth.js
│   ├── users.js
│   ├── friends.js
│   ├── mails.js
│   ├── messages.js
│   ├── profile.js
│   └── admin.js
├── uploads/             # Archivos subidos (se crea automáticamente)
├── index.js             # Servidor principal
└── package.json
```

## API Endpoints

### Autenticación (`/api/auth`)
| Método | Ruta       | Descripción          |
|--------|------------|----------------------|
| POST   | `/register`| Registrar nuevo usuario |
| POST   | `/login`   | Iniciar sesión       |

### Usuarios (`/api/users`)
| Método | Ruta         | Descripción                          |
|--------|--------------|--------------------------------------|
| GET    | `/`          | Obtener lista de usuarios (sin bloqueados) |
| GET    | `/blocked`   | Obtener usuarios bloqueados por el usuario actual |

### Amigos (`/api/friends`)
| Método | Ruta             | Descripción                          |
|--------|------------------|--------------------------------------|
| GET    | `/`              | Obtener amigos del usuario           |
| GET    | `/requests`      | Obtener solicitudes de amistad pendientes |
| POST   | `/requests`      | Enviar solicitud de amistad          |
| PUT    | `/requests/:id`  | Aceptar/rechazar solicitud           |
| DELETE | `/:friendId`     | Eliminar amigo                       |
| POST   | `/block/:userId` | Bloquear usuario                     |
| DELETE | `/block/:userId` | Desbloquear usuario                  |

### Correos (`/api/mails`)
| Método | Ruta       | Descripción                          |
|--------|------------|--------------------------------------|
| GET    | `/`        | Obtener bandeja de entrada           |
| GET    | `/sent`    | Obtener correos enviados             |
| POST   | `/`        | Enviar correo (con archivos adjuntos)|
| PUT    | `/:id/read`| Marcar correo como leído             |
| DELETE | `/:id`     | Eliminar correo                      |

### Perfil (`/api/profile`)
| Método | Ruta          | Descripción                          |
|--------|---------------|--------------------------------------|
| GET    | `/`           | Obtener perfil del usuario           |
| PUT    | `/`           | Actualizar perfil                    |
| PUT    | `/avatar`    | Subir/actualizar avatar              |

### Administración (`/api/admin`)
| Método | Ruta          | Descripción                          |
|--------|---------------|--------------------------------------|
| GET    | `/stats`      | Obtener estadísticas globales        |
| GET    | `/users`      | Obtener todos los usuarios           |
| POST   | `/users`      | Crear nuevo usuario                  |
| PUT    | `/users/:id`  | Editar usuario                       |
| DELETE | `/users/:id`  | Eliminar usuario                     |

## Socket.io Events

### Cliente → Servidor
| Evento            | Descripción                          |
|-------------------|--------------------------------------|
| `authenticate`    | Autenticar conexión con token JWT    |
| `public-message`  | Enviar mensaje al chat público       |
| `private-message` | Enviar mensaje privado               |

### Servidor → Cliente
| Evento            | Descripción                          |
|-------------------|--------------------------------------|
| `public-message`  | Nuevo mensaje en chat público        |
| `private-message` | Nuevo mensaje privado                |
| `notification`    | Notificación de nuevo mensaje        |
| `banned`          | Usuario baneado por spam             |

## Cuenta de Administrador predeterminada

Cuando inicies el backend por primera vez, se creará automáticamente:
- **Email**: `admin@idk-mail.local`
- **Contraseña**: `admin123`
- **Usuario**: `admin`

¡Cambia la contraseña de inmediato!

## Características importantes

- **Anti-spam**: Cooldown de 5 segundos en chat público, baneo automático después de 5 intentos
- **Límite de almacenamiento**: 10GB por usuario (configurable)
- **HTTPS configurable**
- **CORS configurable**
