import { useEffect, useState } from 'react'
import Acceso from './Acceso.jsx'
import Notas from './Notas.jsx'

export default function App() {
  const [nombre, setNombre] = useState(null)
  const [lista, setLista] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    fetch('/api/sesion')
      .then(async function (respuesta) {
        if (respuesta.ok) {
          const datos = await respuesta.json()
          setNombre(datos.nombre)
        }
        setLista(true)
      })
      .catch(function () {
        setLista(true)
        setAviso('El servidor no responde. En la carpeta del proyecto ejecuta: node servidor.js')
      })
  }, [])

  return (
    <>
      <header className="cabecera">
        <p className="etiqueta">Lección 5</p>
        <h1>Mi primera página</h1>
        <p className="intro">
          La página ahora está en tres funciones: <strong>App</strong>, <strong>Acceso</strong> y <strong>Notas</strong>. Cada función es un componente: devuelve una parte de la página. El programa <strong>Vite</strong> lee esos archivos y le entrega al navegador el JavaScript que puede ejecutar. <strong>servidor.js</strong> sigue igual, en el puerto 5500.
        </p>
      </header>
      <main>
        <section className="piezas" aria-label="Las partes de la página">
          <article>
            <h2>Componente</h2>
            <p>Una función de React. Devuelve el HTML de una parte de la página.</p>
          </article>
          <article>
            <h2>JSX</h2>
            <p>El HTML escrito dentro de la función. Vite lo convierte en JavaScript.</p>
          </article>
          <article>
            <h2>Estado</h2>
            <p>Un dato que el componente recuerda. Si cambia, React vuelve a dibujar esa parte.</p>
          </article>
          <article>
            <h2>Servidor</h2>
            <p>Sigue siendo servidor.js. Esta página le manda las mismas peticiones.</p>
          </article>
        </section>
        {aviso ? <p className="mensaje">{aviso}</p> : null}
        {lista && nombre ? <Notas nombre={nombre} alSalir={() => setNombre(null)} /> : null}
        {lista && !nombre ? <Acceso alEntrar={setNombre} /> : null}
      </main>
    </>
  )
}
