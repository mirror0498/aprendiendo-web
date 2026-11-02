const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const PUERTO = Number(process.env.PORT) || 5500;
const ARCHIVO_BASE = path.join(__dirname, "notas.db");
const ARCHIVO_JSON = path.join(__dirname, "notas.json");

const base = new DatabaseSync(ARCHIVO_BASE);

base.exec(`
  CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL
  )
`);

const columnasNotas = base.prepare("PRAGMA table_info(notas)").all();
const tieneUsuario = columnasNotas.some(function (columna) {
  return columna.name === "usuario_id";
});

if (!tieneUsuario) {
  base.exec("ALTER TABLE notas ADD COLUMN usuario_id INTEGER");
}

base.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    sal TEXT NOT NULL,
    clave_hash TEXT NOT NULL
  )
`);

base.exec(`
  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL
  )
`);

pasarNotasDelJson();

const CARPETA_PAGINA = path.join(__dirname, "cliente", "dist");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function leerNotas(usuarioId) {
  return base.prepare(
    "SELECT id, texto FROM notas WHERE usuario_id = ? ORDER BY id"
  ).all(usuarioId).map(function (nota) {
    return { id: Number(nota.id), texto: nota.texto };
  });
}

function pasarNotasDelJson() {
  if (!fs.existsSync(ARCHIVO_JSON)) {
    return;
  }

  const cantidad = base.prepare("SELECT COUNT(*) AS total FROM notas").get().total;

  if (Number(cantidad) > 0) {
    return;
  }

  const viejas = JSON.parse(fs.readFileSync(ARCHIVO_JSON, "utf8"));
  const insertar = base.prepare("INSERT INTO notas (texto) VALUES (?)");

  for (const nota of viejas) {
    insertar.run(nota.texto);
  }

  fs.unlinkSync(ARCHIVO_JSON);
}

function enviarJson(respuesta, codigo, datos, encabezadosExtra) {
  respuesta.writeHead(codigo, {
    "Content-Type": "application/json; charset=utf-8",
    ...encabezadosExtra,
  });
  respuesta.end(JSON.stringify(datos));
}

function leerCuerpo(peticion) {
  return new Promise(function (resolver, rechazar) {
    let cuerpo = "";
    peticion.on("data", function (parte) {
      cuerpo += parte;
    });
    peticion.on("end", function () {
      resolver(cuerpo);
    });
    peticion.on("error", rechazar);
  });
}

async function leerJson(peticion, respuesta) {
  try {
    return JSON.parse(await leerCuerpo(peticion));
  } catch {
    enviarJson(respuesta, 400, { error: "El cuerpo no es JSON." });
    return null;
  }
}

function carpetaPagina() {
  if (fs.existsSync(path.join(CARPETA_PAGINA, "index.html"))) {
    return CARPETA_PAGINA;
  }

  return __dirname;
}

function servirArchivo(respuesta, ruta) {
  const relativo = decodeURIComponent(ruta === "/" ? "index.html" : ruta).replace(/^\/+/, "");
  const raiz = path.resolve(carpetaPagina());
  const archivo = path.resolve(raiz, relativo);

  if (archivo !== raiz && !archivo.startsWith(raiz + path.sep)) {
    respuesta.writeHead(403);
    respuesta.end("No permitido");
    return;
  }

  fs.readFile(archivo, function (error, contenido) {
    if (error) {
      respuesta.writeHead(404);
      respuesta.end("No encontrado");
      return;
    }

    const tipo = TIPOS[path.extname(archivo)] || "text/plain; charset=utf-8";
    respuesta.writeHead(200, { "Content-Type": tipo });
    respuesta.end(contenido);
  });
}

function crearHash(clave) {
  const sal = crypto.randomBytes(16).toString("hex");
  const claveHash = crypto.scryptSync(clave, sal, 32).toString("hex");
  return { sal, claveHash };
}

function claveCoincide(clave, sal, claveHash) {
  const calculado = crypto.scryptSync(clave, sal, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(calculado, "hex"), Buffer.from(claveHash, "hex"));
}

function cookieSesion(token) {
  if (!token) {
    return "sesion=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
  }

  return `sesion=${token}; HttpOnly; SameSite=Lax; Path=/`;
}

function tokenDesdePeticion(peticion) {
  const encabezado = peticion.headers.cookie || "";
  const partes = encabezado.split(";");

  for (const parte of partes) {
    const texto = parte.trim();
    if (texto.startsWith("sesion=")) {
      return texto.slice("sesion=".length);
    }
  }

  return "";
}

function usuarioDesdePeticion(peticion) {
  const token = tokenDesdePeticion(peticion);

  if (token === "") {
    return null;
  }

  const sesion = base.prepare("SELECT usuario_id FROM sesiones WHERE token = ?").get(token);

  if (!sesion) {
    return null;
  }

  const usuario = base.prepare("SELECT id, nombre FROM usuarios WHERE id = ?").get(sesion.usuario_id);

  if (!usuario) {
    return null;
  }

  return { id: Number(usuario.id), nombre: usuario.nombre };
}

function exigirUsuario(peticion, respuesta) {
  const usuario = usuarioDesdePeticion(peticion);

  if (!usuario) {
    enviarJson(respuesta, 401, { error: "Entra con tu nombre y tu clave." });
    return null;
  }

  return usuario;
}

function abrirSesion(respuesta, usuario) {
  const token = crypto.randomBytes(24).toString("hex");
  base.prepare("INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)").run(token, usuario.id);
  enviarJson(respuesta, 200, { nombre: usuario.nombre }, { "Set-Cookie": cookieSesion(token) });
}

function datosCuenta(datos) {
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  const clave = typeof datos.clave === "string" ? datos.clave : "";
  return { nombre, clave };
}

async function registrar(peticion, respuesta) {
  const datos = await leerJson(peticion, respuesta);

  if (!datos) {
    return;
  }

  const { nombre, clave } = datosCuenta(datos);

  if (nombre === "" || nombre.length > 40 || clave.length < 4 || clave.length > 80) {
    enviarJson(respuesta, 400, { error: "Nombre de hasta 40 caracteres y clave de 4 a 80." });
    return;
  }

  const existe = base.prepare("SELECT id FROM usuarios WHERE nombre = ?").get(nombre);

  if (existe) {
    enviarJson(respuesta, 400, { error: "Ese nombre ya está usado." });
    return;
  }

  const { sal, claveHash } = crearHash(clave);
  const resultado = base.prepare(
    "INSERT INTO usuarios (nombre, sal, clave_hash) VALUES (?, ?, ?)"
  ).run(nombre, sal, claveHash);

  abrirSesion(respuesta, { id: Number(resultado.lastInsertRowid), nombre });
}

async function entrar(peticion, respuesta) {
  const datos = await leerJson(peticion, respuesta);

  if (!datos) {
    return;
  }

  const { nombre, clave } = datosCuenta(datos);
  const usuario = base.prepare(
    "SELECT id, nombre, sal, clave_hash FROM usuarios WHERE nombre = ?"
  ).get(nombre);

  if (!usuario || !claveCoincide(clave, usuario.sal, usuario.clave_hash)) {
    enviarJson(respuesta, 401, { error: "Nombre o clave incorrectos." });
    return;
  }

  abrirSesion(respuesta, { id: Number(usuario.id), nombre: usuario.nombre });
}

function salir(peticion, respuesta) {
  const token = tokenDesdePeticion(peticion);

  if (token !== "") {
    base.prepare("DELETE FROM sesiones WHERE token = ?").run(token);
  }

  enviarJson(respuesta, 200, { ok: true }, { "Set-Cookie": cookieSesion("") });
}

async function agregarNota(peticion, respuesta, usuario) {
  const datos = await leerJson(peticion, respuesta);

  if (!datos) {
    return;
  }

  const texto = typeof datos.texto === "string" ? datos.texto.trim() : "";

  if (texto === "" || texto.length > 80) {
    enviarJson(respuesta, 400, { error: "Escribe una nota de hasta 80 caracteres." });
    return;
  }

  const resultado = base.prepare(
    "INSERT INTO notas (texto, usuario_id) VALUES (?, ?)"
  ).run(texto, usuario.id);
  const nota = base.prepare("SELECT id, texto FROM notas WHERE id = ?").get(resultado.lastInsertRowid);

  enviarJson(respuesta, 201, { id: Number(nota.id), texto: nota.texto });
}

function borrarNota(respuesta, id, usuario) {
  const resultado = base.prepare(
    "DELETE FROM notas WHERE id = ? AND usuario_id = ?"
  ).run(id, usuario.id);

  if (resultado.changes === 0) {
    enviarJson(respuesta, 404, { error: "Esa nota no existe." });
    return;
  }

  enviarJson(respuesta, 200, { ok: true });
}

const servidor = http.createServer(async function (peticion, respuesta) {
  const url = new URL(peticion.url, `http://127.0.0.1:${PUERTO}`);

  if (peticion.method === "POST" && url.pathname === "/api/registro") {
    await registrar(peticion, respuesta);
    return;
  }

  if (peticion.method === "POST" && url.pathname === "/api/entrar") {
    await entrar(peticion, respuesta);
    return;
  }

  if (peticion.method === "POST" && url.pathname === "/api/salir") {
    salir(peticion, respuesta);
    return;
  }

  if (peticion.method === "GET" && url.pathname === "/api/sesion") {
    const usuario = usuarioDesdePeticion(peticion);

    if (!usuario) {
      enviarJson(respuesta, 401, { error: "Entra con tu nombre y tu clave." });
      return;
    }

    enviarJson(respuesta, 200, { nombre: usuario.nombre });
    return;
  }

  if (peticion.method === "GET" && url.pathname === "/api/notas") {
    const usuario = exigirUsuario(peticion, respuesta);

    if (!usuario) {
      return;
    }

    enviarJson(respuesta, 200, leerNotas(usuario.id));
    return;
  }

  if (peticion.method === "POST" && url.pathname === "/api/notas") {
    const usuario = exigirUsuario(peticion, respuesta);

    if (!usuario) {
      return;
    }

    await agregarNota(peticion, respuesta, usuario);
    return;
  }

  const borrado = url.pathname.match(/^\/api\/notas\/(\d+)$/);

  if (peticion.method === "DELETE" && borrado) {
    const usuario = exigirUsuario(peticion, respuesta);

    if (!usuario) {
      return;
    }

    borrarNota(respuesta, Number(borrado[1]), usuario);
    return;
  }

  if (peticion.method === "GET") {
    servirArchivo(respuesta, url.pathname);
    return;
  }

  enviarJson(respuesta, 404, { error: "Ruta no encontrada." });
});

servidor.listen(PUERTO, function () {
  console.log(`Abre http://127.0.0.1:${PUERTO}`);
});
