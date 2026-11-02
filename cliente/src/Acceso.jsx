import { useState } from 'react'

export default function Acceso({ alEntrar }) {
  const [mensaje, setMensaje] = useState('')
  const [esExito, setEsExito] = useState(false)

  async function enviar(evento, ruta) {
    evento.preventDefault()
    const datos = new FormData(evento.target)
    const nombre = String(datos.get('nombre') || '').trim()
    const clave = String(datos.get('clave') || '')

    if (nombre === '' || clave === '') {
      setEsExito(false)
      setMensaje('Escribe nombre y clave.')
      return
    }

    const respuesta = await fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, clave }),
    })
    const cuerpo = await respuesta.json()

    if (!respuesta.ok) {
      setEsExito(false)
      setMensaje(cuerpo.error || 'No se pudo completar.')
      return
    }

    evento.target.reset()
    setEsExito(true)
    setMensaje(ruta === '/api/registro' ? 'Cuenta creada.' : 'Entraste.')
    alEntrar(cuerpo.nombre)
  }

  return (
    <section className="panel" id="acceso">
      <h2>Entrar</h2>
      <p className="ayuda">
        Crea una cuenta o entra. La lista es solo de esa cuenta. El servidor sigue en el puerto 5500.
      </p>
      <form onSubmit={(evento) => enviar(evento, '/api/registro')}>
        <label htmlFor="registro-nombre">Nombre nuevo</label>
        <div className="fila">
          <input id="registro-nombre" name="nombre" type="text" maxLength={40} autoComplete="off" />
          <input name="clave" type="password" maxLength={80} placeholder="Clave, mínimo 4" autoComplete="new-password" aria-label="Clave nueva" />
          <button type="submit">Crear cuenta</button>
        </div>
      </form>
      <form onSubmit={(evento) => enviar(evento, '/api/entrar')}>
        <label htmlFor="entrar-nombre">Ya tengo cuenta</label>
        <div className="fila">
          <input id="entrar-nombre" name="nombre" type="text" maxLength={40} autoComplete="username" />
          <input name="clave" type="password" maxLength={80} placeholder="Clave" autoComplete="current-password" aria-label="Clave" />
          <button type="submit">Entrar</button>
        </div>
      </form>
      <p className={esExito ? 'mensaje ok' : 'mensaje'} role="status">{mensaje}</p>
    </section>
  )
}
