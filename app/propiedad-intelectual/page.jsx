import LegalPage from '@/app/components/LegalPage'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR_NAME,
  LEGAL_UPDATED_LABEL,
} from '@/lib/legalConfig'

export const metadata = {
  title: 'Propiedad Intelectual y Retiro de Contenido | Repuestos Mérida',
  description:
    'Procedimiento para denunciar contenido ilícito o que infrinja derechos de propiedad intelectual.',
  alternates: { canonical: '/propiedad-intelectual' },
}

function cleanReference(value) {
  return String(value || '').replace(/[\r\n]/g, ' ').trim().slice(0, 300)
}

export default async function PropiedadIntelectual({ searchParams }) {
  const query = await searchParams
  const reference = cleanReference(query?.contenido)
  const subject = encodeURIComponent('Aviso de contenido — Repuestos Mérida')
  const body = encodeURIComponent(
    [
      `Contenido denunciado: ${reference || 'Incluye la URL o referencia exacta'}`,
      'Tipo de reclamación: derechos de autor / marca / privacidad / fraude / otro',
      'Descripción:',
      'Obra o derecho afectado:',
      'Nombre y datos de contacto del denunciante:',
      'Declaro de buena fe que la información suministrada es exacta:',
    ].join('\n'),
  )

  return (
    <LegalPage title="Propiedad intelectual y retiro de contenido" updated={LEGAL_UPDATED_LABEL}>
      <section>
        <h2>1. Contacto para avisos</h2>
        <p className="mt-2">
          Los avisos relacionados con contenido publicado en Repuestos Mérida son recibidos por{' '}
          {LEGAL_OPERATOR_NAME}, operador de la plataforma, mediante{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=${subject}&body=${body}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
        {reference && (
          <p className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
            Referencia seleccionada: <strong>{reference}</strong>
          </p>
        )}
      </section>

      <section>
        <h2>2. Qué debe incluir el aviso</h2>
        <ul className="mt-2">
          <li>Identificación de la obra, marca, dato personal o derecho afectado.</li>
          <li>URL, identificador o información suficiente para localizar el material.</li>
          <li>Nombre, correo, dirección y teléfono del reclamante o su representante.</li>
          <li>Explicación de por qué el uso no está autorizado o resulta ilícito.</li>
          <li>Declaración de buena fe y confirmación de que la información es exacta.</li>
          <li>Firma física o electrónica cuando se aleguen derechos de autor.</li>
        </ul>
      </section>

      <section>
        <h2>3. Revisión y retiro</h2>
        <p className="mt-2">
          Revisaremos los avisos completos y podremos retirar o bloquear preventivamente el
          material, solicitar información adicional y notificar al usuario que lo publicó. Los
          avisos fraudulentos o deliberadamente falsos podrán rechazarse y conservarse como
          evidencia de abuso.
        </p>
      </section>

      <section>
        <h2>4. Respuesta del usuario</h2>
        <p className="mt-2">
          El usuario afectado puede responder identificando el material retirado, explicando por
          qué considera que existió un error, suministrando sus datos de contacto y declarando de
          buena fe que posee autorización o un fundamento legítimo. Evaluaremos la respuesta antes
          de restaurar contenido.
        </p>
      </section>

      <section>
        <h2>5. Infractores reincidentes</h2>
        <p className="mt-2">
          Podemos suspender o terminar cuentas que reiteradamente publiquen contenido infractor,
          ilícito o contrario a las reglas, considerando la gravedad, el número de avisos fundados
          y la respuesta del usuario.
        </p>
      </section>

      <section>
        <h2>6. Estado del registro DMCA</h2>
        <p className="mt-2">
          Este procedimiento permite recibir y gestionar reclamaciones, pero Repuestos Mérida no
          declara actualmente tener un agente DMCA registrado ante la U.S. Copyright Office. Si se
          completa esa designación, esta página se actualizará con los datos oficiales.
        </p>
      </section>
    </LegalPage>
  )
}
