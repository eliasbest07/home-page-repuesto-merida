import LegalPage from '@/app/components/LegalPage'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR_NAME,
  LEGAL_UPDATED_LABEL,
} from '@/lib/legalConfig'

export const metadata = {
  title: 'Política de Cookies | Repuestos Mérida',
  description: 'Información sobre las cookies utilizadas por Repuestos Mérida.',
  alternates: { canonical: '/politica-cookies' },
}

export default function PoliticaCookies() {
  return (
    <LegalPage title="Política de Cookies" updated={LEGAL_UPDATED_LABEL}>
      <section>
        <p>
          Esta política corresponde al sitio operado por <strong>{LEGAL_OPERATOR_NAME}</strong>.
        </p>
      </section>
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
            <strong>Medición y analítica:</strong> Vercel Analytics y las mediciones internas solo
            se activan después de aceptar las tecnologías opcionales.
          </li>
          <li>
            <strong>Publicitarias:</strong> Google AdSense solo se carga después de aceptar las
            tecnologías opcionales y cuando la publicidad está habilitada.
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
          Las tecnologías necesarias se usan para prestar las funciones solicitadas y mantener la
          seguridad. Al entrar al sitio puedes aceptar o rechazar las opcionales. Después puedes pulsar
          el botón “Cookies”, visible en la parte inferior mientras las cookies opcionales estén
          rechazadas, para cambiar tu elección.
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
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  )
}
