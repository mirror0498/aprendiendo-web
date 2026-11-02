const acceso = document.querySelector("#acceso");
const panelNotas = document.querySelector("#panel-notas");
const formularioEntrar = document.querySelector("#formulario-entrar");
const formularioRegistro = document.querySelector("#formulario-registro");
const formulario = document.querySelector("#formulario");
const campoNota = document.querySelector("#nota");
const mensajeAcceso = document.querySelector("#mensaje-acceso");
const mensaje = document.querySelector("#mensaje");
const lista = document.querySelector("#lista");
const vacio = document.querySelector("#vacio");
const nombreUsuario = document.querySelector("#nombre-usuario");
const botonSalir = document.querySelector("#salir");

formularioEntrar.addEventListener("submit", function (evento) {
  evento.preventDefault();
  enviarCuenta("/api/entrar", formularioEntrar, "Entraste.");
});

formularioRegistro.addEventListener("submit", function (evento) {
  evento.preventDefault();
  enviarCuenta("/api/registro", formularioRegistro, "Cuenta creada.");
});

formulario.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const texto = campoNota.value.trim();

  if (texto === "") {
    mostrarMensaje(mensaje, "Escribe una nota antes de agregarla.", false);
    campoNota.focus();
    return;
  }

  const respuesta = await fetch("/api/notas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });

  if (!respuesta.ok) {
    mostrarMensaje(mensaje, "No se pudo guardar la nota.", false);
    return;
  }

  const nota = await respuesta.json();
  lista.append(crearItem(nota));
  campoNota.value = "";
  campoNota.focus();
  mostrarMensaje(mensaje, "Nota guardada.", true);
  actualizarVacio();
});

botonSalir.addEventListener("click", async function () {
  const respuesta = await fetch("/api/salir", { method: "POST" });

  if (!respuesta.ok) {
    mostrarMensaje(mensaje, "No se pudo salir.", false);
    return;
  }

  lista.replaceChildren();
  mostrarAcceso();
  mostrarMensaje(mensajeAcceso, "Saliste.", true);
});

async function enviarCuenta(ruta, formularioCuenta, textoExito) {
  const datos = new FormData(formularioCuenta);
  const nombre = String(datos.get("nombre") || "").trim();
  const clave = String(datos.get("clave") || "");

  if (nombre === "" || clave === "") {
    mostrarMensaje(mensajeAcceso, "Escribe nombre y clave.", false);
    return;
  }

  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, clave }),
  });
  const cuerpo = await respuesta.json();

  if (!respuesta.ok) {
    mostrarMensaje(mensajeAcceso, cuerpo.error || "No se pudo completar.", false);
    return;
  }

  formularioCuenta.reset();
  mostrarMensaje(mensajeAcceso, textoExito, true);
  await mostrarNotas(cuerpo.nombre);
}

async function cargarNotas() {
  const respuesta = await fetch("/api/notas");

  if (!respuesta.ok) {
    throw new Error("No se pudieron leer las notas.");
  }

  const notas = await respuesta.json();
  lista.replaceChildren();

  for (const nota of notas) {
    lista.append(crearItem(nota));
  }

  actualizarVacio();
}

function crearItem(nota) {
  const item = document.createElement("li");
  const nombre = document.createElement("span");
  nombre.textContent = nota.texto;

  const botonBorrar = document.createElement("button");
  botonBorrar.type = "button";
  botonBorrar.className = "borrar";
  botonBorrar.textContent = "Borrar";
  botonBorrar.addEventListener("click", async function () {
    const respuesta = await fetch(`/api/notas/${nota.id}`, { method: "DELETE" });

    if (!respuesta.ok) {
      mostrarMensaje(mensaje, "No se pudo borrar la nota.", false);
      return;
    }

    item.remove();
    actualizarVacio();
    mostrarMensaje(mensaje, "Nota borrada.", true);
  });

  item.append(nombre, botonBorrar);
  return item;
}

function mostrarAcceso() {
  acceso.classList.remove("oculto");
  panelNotas.classList.add("oculto");
}

async function mostrarNotas(nombre) {
  nombreUsuario.textContent = nombre;
  acceso.classList.add("oculto");
  panelNotas.classList.remove("oculto");
  mostrarMensaje(mensaje, "", true);
  await cargarNotas();
}

function mostrarMensaje(elemento, texto, esExito) {
  elemento.textContent = texto;
  elemento.classList.toggle("ok", esExito);
}

function actualizarVacio() {
  const hayNotas = lista.children.length > 0;
  vacio.classList.toggle("oculto", hayNotas);
}

async function iniciar() {
  try {
    const respuesta = await fetch("/api/sesion");

    if (!respuesta.ok) {
      mostrarAcceso();
      return;
    }

    const datos = await respuesta.json();
    await mostrarNotas(datos.nombre);
  } catch {
    mostrarAcceso();
    mostrarMensaje(mensajeAcceso, "El servidor no responde. En esta carpeta ejecuta: node servidor.js", false);
  }
}

iniciar();
