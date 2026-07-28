import LegalPage from '@/app/components/LegalPage'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR_NAME,
  LEGAL_UPDATED_LABEL,
} from '@/lib/legalConfig'

export const metadata = {
  title: 'Eliminar Datos | Repuestos Mérida',
  description:
    'Instrucciones para solicitar la eliminación de datos personales asociados a Repuestos Mérida.',
  alternates: { canonical: '/eliminar-datos' },
}

export default function EliminarDatos() {
  const subject = encodeURIComponent('Solicitud de eliminación de datos Repuestos Mérida')
  const body = encodeURIComponent(
    'Nombre:\nNúmero de WhatsApp o correo asociado:\nDatos o cuenta que deseas eliminar:\n',
  )

  return (
    <LegalPage title="Eliminar mis datos" updated={LEGAL_UPDATED_LABEL}>
      <section>
        <h2>1. Responsable</h2>
        <p className="mt-2">
          Repuestos Mérida es operada por {LEGAL_OPERATOR_NAME}, persona natural. Puedes solicitar
          la eliminación de información asociada al sitio web y a la aplicación móvil.
        </p>
      </section>

      <section>
        <h2>2. Cómo presentar la solicitud</h2>
        <p className="mt-2">
          Envía un correo a{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=${subject}&body=${body}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>{' '}
          con el asunto “Solicitud de eliminación de datos Repuestos Mérida”. Indica el número de
          WhatsApp o correo asociado y qué cuenta, publicación o información deseas eliminar. No
          adjuntes una nueva foto de tu cédula salvo que te la solicitemos expresamente para
          resolver una duda de identidad.
        </p>
      </section>

      <section>
        <h2>3. Verificación y plazo</h2>
        <p className="mt-2">
          Confirmaremos la recepción y podremos pedir una verificación proporcional para impedir
          que otra persona elimine tu cuenta. Procuraremos completar la solicitud dentro de un
          máximo de 30 días. Si la solicitud es compleja o existe una obligación que impida borrar
          inmediatamente determinados registros, te informaremos.
        </p>
      </section>

      <section>
        <h2>4. Qué se elimina</h2>
        <p className="mt-2">
          Según tu solicitud, podremos eliminar o anonimizar perfil, datos de contacto, documentos
          de verificación, publicaciones, imágenes y demás información vinculada. El contenido que
          también forme parte de registros de seguridad, respaldos, reclamaciones o evidencia legal
          puede conservarse durante el periodo estrictamente necesario.
        </p>
      </section>

      <section>
        <h2>5. Consecuencias</h2>
        <p className="mt-2">
          La eliminación puede impedirte recuperar publicaciones, beneficios, historial y acceso a
          funciones verificadas. Guarda antes cualquier información que necesites conservar.
        </p>
      </section>
    </LegalPage>
  )
}
