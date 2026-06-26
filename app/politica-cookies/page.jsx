import LegalPage from '@/app/components/LegalPage'

export const metadata = {
  title: 'Política de Cookies | Repuestos Mérida',
  description: 'Información sobre las cookies utilizadas por Repuestos Mérida.',
}

export default function PoliticaCookies() {
  return (
    <LegalPage title="Política de Cookies" updated="10 de junio de 2026">
      <section>
        <h2>1. Qué son las cookies</h2>
        <p className="mt-2">
          Las cookies son pequeños archivos que un sitio guarda en el navegador para recordar
          preferencias, mantener sesiones, medir el uso y, cuando el usuario lo autoriza, mostrar
          publicidad.
        </p>
      </section>

      <section>
        <h2>2. Cookies que utilizamos</h2>
        <ul className="mt-2">
          <li>
            <strong>Necesarias:</strong> permiten funciones esenciales como autenticación, seguridad
            y conservación de la preferencia de cookies.
          </li>
          <li>
            <strong>Publicitarias:</strong> si se activan anuncios, el proveedor publicitario puede
            utilizarlas para mostrar, limitar y medir anuncios conforme al consentimiento del usuario.
          </li>
          <li>
            <strong>De terceros:</strong> determinadas funciones de Google, Firebase, mapas o
            servicios enlazados pueden aplicar sus propias tecnologías y políticas.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Proveedor publicitario</h2>
        <p className="mt-2">
          Google puede usar cookies u otros identificadores para prestar sus servicios
          publicitarios. Puedes consultar cómo utiliza Google la información en{' '}
          <a href="https://policies.google.com/technologies/partner-sites">
            Cómo usa Google la información de sitios o aplicaciones
          </a>
          .
        </p>
      </section>

      <section>
        <h2>4. Cómo gestionar tu decisión</h2>
        <p className="mt-2">
          Al entrar al sitio puedes aceptar o rechazar las cookies opcionales. Después puedes pulsar
          el botón “Cookies”, visible en la parte inferior de la pantalla, para cambiar tu elección.
          También puedes bloquear o borrar cookies desde la configuración de tu navegador.
        </p>
      </section>

      <section>
        <h2>5. Consecuencias de rechazarlas</h2>
        <p className="mt-2">
          Rechazar las cookies opcionales no impide navegar por el sitio. Algunas funciones externas
          o anuncios podrían no mostrarse, pero las funciones esenciales seguirán disponibles.
        </p>
      </section>

      <section>
        <h2>6. Contacto</h2>
        <p className="mt-2">
          Para consultas sobre esta política, escribe a{' '}
          <a href="mailto:ahoraesbest@gmail.com">ahoraesbest@gmail.com</a>.
        </p>
      </section>
    </LegalPage>
  )
}
