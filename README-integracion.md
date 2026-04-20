# Integración de login con Firebase + Netlify

## Qué hace esta versión
- Login con correo y contraseña.
- Login con Google.
- Login con Microsoft.
- Sin registro público.
- Validación contra una allowlist en Firestore: solo entra quien tú hayas autorizado.

## Estructura de autorización recomendada
Crea en Firestore una colección:

- `allowedUsers`
  - documento ID: el correo en minúsculas, por ejemplo `antonio@empresa.com`
  - contenido sugerido:

```json
{
  "active": true,
  "role": "admin",
  "redirectPath": "/dashboard.html"
}
```

## Cómo dar acceso a un usuario
### Opción 1: correo + contraseña
1. Firebase Console -> Authentication -> Users.
2. Añade el usuario manualmente.
3. En Firestore, crea también su documento en `allowedUsers`.

### Opción 2: Google o Microsoft
1. Activa el proveedor en Firebase Authentication.
2. Añade antes su correo a `allowedUsers`.
3. Cuando inicie sesión, podrá entrar solo si su correo ya está en la allowlist.

## Firestore Rules recomendadas
Estas reglas permiten que cada usuario autenticado lea solo su propio documento de allowlist y que el resto de datos quede protegido para usuarios autorizados.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function userEmail() {
      return lower(request.auth.token.email);
    }

    function isAllowed() {
      return signedIn() &&
        exists(/databases/$(database)/documents/allowedUsers/$(userEmail())) &&
        get(/databases/$(database)/documents/allowedUsers/$(userEmail())).data.active == true;
    }

    match /allowedUsers/{email} {
      allow read: if signedIn() && email == userEmail();
      allow write: if false;
    }

    match /reports/{docId} {
      allow read, write: if isAllowed();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Authentication: qué activar
En Firebase Console -> Authentication -> Sign-in method:
- Email/Password
- Google
- Microsoft

## Dominios autorizados
En Firebase Authentication añade:
- tu dominio de Netlify, por ejemplo `miapp.netlify.app`
- tu dominio propio cuando lo tengas

## Configuración del frontend
Tienes dos opciones:

### Opción rápida
1. Renombra `firebase-config.example.js` a `firebase-config.js`.
2. Rellena tus datos de Firebase.
3. Incluye este script antes de `js/firebase-auth.js` en `index.html`.

### Opción más segura para despliegue
Usa una función de Netlify para inyectar configuración pública y no dejarla hardcodeada en el HTML. Aun así, recuerda: la seguridad real está en Firebase Auth + Firestore Rules, no en ocultar la config pública.

## Importante
- La configuración de Firebase web no es un secreto real. Lo importante es cerrar Firestore con reglas.
- No dejes enlaces de "Crear cuenta" si no quieres registro libre.
- Si quieres panel de administración para altas/bajas de usuarios, lo correcto es hacerlo con una Netlify Function o backend, nunca desde el cliente.
