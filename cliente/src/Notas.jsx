import { useEffect, useState } from 'react'

export default function Notas({ nombre, alSalir }) {
  const [notas, setNotas] = useState([])
  const [texto, setTexto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [esExito, setEsExito] = useState(true)

  useEffect(() => {
    fetch('/api/notas')
      .then(async function (respuesta) {
        if (respuesta.ok) {
          setNotas(await respuesta.json())
        }
      })
  }, [])

  async function agregar(evento) {
    evento.preventDefault()
    const limpio = texto.trim()

    if (limpio === '') {
      setEsExito(false)
      setMensaje('Escribe una nota antes de agregarla.')
      return
    }

    const respuesta = await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: limpio }),
    })

    if (!respuesta.ok) {
      setEsExito(false)
      setMensaje('No se pudo guardar la nota.')
      return
    }

    const nota = await respuesta.json()
    setNotas(function (anteriores) {
      return anteriores.concat(nota)
    })
    setTexto('')
    setEsExito(true)
    setMensaje('Nota guardada.')
  }

  async function borrar(id) {
    const respuesta = await fetch(`/api/notas/${id}`, { method: 'DELETE' })

    if (!respuesta.ok) {
      setEsExito(false)
      setMensaje('No se pudo borrar la nota.')
      return
    }

    setNotas(function (anteriores) {
      return anteriores.filter(function (nota) {
        return nota.id !== id
      })
    })
    setEsExito(true)
    setMensaje('Nota borrada.')
  }

  async function salir() {
    const respuesta = await fetch('/api/salir', { method: 'POST' })

    if (!respuesta.ok) {
      setEsExito(false)
      setMensaje('No se pudo salir.')
      return
    }

    alSalir()
  }

  return (
    <section className="panel">
      <div className="encabezado-panel">
        <h2>Notas de {nombre}</h2>
        <button type="button" className="borrar" onClick={salir}>Salir</button>
      </div>
      <p className="ayuda">
        Agrega una nota y recarga. Sigues adentro y la nota sigue. Sal y entra con otra cuenta: esta nota no aparece.
      </p>
      <form onSubmit={agregar}>
        <label htmlFor="nota">Qué quieres anotar</label>
        <div className="fila">
          <input
            id="nota"
            value={texto}
            onChange={function (evento) { setTexto(evento.target.value) }}
            type="text"
            maxLength={80}
            placeholder="Por ejemplo: practicar Flexbox"
            autoComplete="off"
          />
          <button type="submit">Agregar</button>
        </div>
        <p className={esExito ? 'mensaje ok' : 'mensaje'} role="status">{mensaje}</p>
      </form>
      {notas.length === 0 ? <p className="vacio">Todavía no hay notas. Escribe la primera arriba.</p> : null}
      <ul className="lista">
        {notas.map(function (nota) {
          return (
            <li key={nota.id}>
              <span>{nota.texto}</span>
              <button type="button" className="borrar" onClick={function () { borrar(nota.id) }}>Borrar</button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
