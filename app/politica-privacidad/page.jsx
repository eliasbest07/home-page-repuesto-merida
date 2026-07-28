import LegalPage from '@/app/components/LegalPage'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR_NAME,
  LEGAL_TRADE_NAME,
  LEGAL_UPDATED_LABEL,
} from '@/lib/legalConfig'

export const metadata = {
  title: 'Política de Privacidad | Repuestos Mérida',
  description:
    'Cómo Repuestos Mérida recopila, usa, protege y permite gestionar los datos personales de usuarios y comercios.',
  alternates: { canonical: '/politica-privacidad' },
}

export default function PoliticaPrivacidad() {
  return (
    <LegalPage title="Política de Privacidad de Repuestos Mérida" updated={LEGAL_UPDATED_LABEL}>
      <section>
        <h2>1. Alcance y responsable</h2>
        <p className="mt-2">
          Esta política se aplica al sitio web, la aplicación móvil y los servicios de Repuestos
          Mérida, operados por <strong>{LEGAL_OPERATOR_NAME}</strong>, persona natural, desde
          Mérida, Venezuela. {LEGAL_TRADE_NAME} es un nombre comercial proyectado que todavía no
          corresponde a una sociedad mercantil registrada.
        </p>
        <p className="mt-2">
          Para consultas de privacidad o solicitudes relacionadas con tus datos, escribe a{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2>2. Información que podemos recopilar</h2>
        <p className="mt-2">Según las funciones que utilices, podemos tratar:</p>
        <ul className="mt-2">
          <li>
            <strong>Identificación y contacto:</strong> nombre, correo electrónico, identificador de
            cuenta de Google, número de WhatsApp, foto de perfil y datos de sesión.
          </li>
          <li>
            <strong>Verificación:</strong> número y foto de la cédula, nombres, apellidos, fecha de
            nacimiento y nacionalidad que puedan leerse en ella, además de una selfie sosteniendo el
            documento y el resultado de la verificación.
          </li>
          <li>
            <strong>Ubicación:</strong> ciudad, zona, dirección comercial y coordenadas elegidas en
            el mapa o compartidas mediante el permiso de ubicación.
          </li>
          <li>
            <strong>Vehículo y comercio:</strong> marca, modelo, año y tipo de vehículo, así como
            nombre, dirección, horarios, fotos y demás información de un comercio.
          </li>
          <li>
            <strong>Contenido del usuario:</strong> anuncios, solicitudes, títulos, descripciones,
            precios, imágenes, audios, comentarios, preguntas, mensajes dirigidos al asistente y
            demás contenido enviado a la plataforma.
          </li>
          <li>
            <strong>Actividad y datos técnicos:</strong> páginas visitadas, duración aproximada de
            la visita, interacciones, identificadores de instalación o sesión, tipo de navegador o
            dispositivo, sistema operativo, región aproximada, dirección IP procesada por nuestros
            proveedores, diagnósticos y registros de errores o seguridad.
          </li>
          <li>
            <strong>Participación en servicios:</strong> datos necesarios para rifas, bingo,
            membresías, autorizaciones, puntos o beneficios de la comunidad.
          </li>
        </ul>
        <p className="mt-2">
          Algunos datos son obligatorios para crear o proteger una cuenta, verificar la edad,
          publicar o acceder a una función; otros son opcionales y se indican en el formulario
          correspondiente.
        </p>
      </section>

      <section>
        <h2>3. De dónde obtenemos la información</h2>
        <p className="mt-2">
          Recibimos información directamente del usuario, de los permisos que este activa en su
          dispositivo, de los métodos de acceso con Google o WhatsApp y de los servicios técnicos
          que operan la plataforma. Algunos anuncios también pueden elaborarse a partir de mensajes
          compartidos en grupos o canales de la comunidad. Si apareces en una publicación y deseas
          corregirla o retirarla, puedes solicitarlo por nuestros canales oficiales.
        </p>
      </section>

      <section>
        <h2>4. Cómo usamos la información</h2>
        <ul className="mt-2">
          <li>Crear, autenticar y administrar cuentas y perfiles.</li>
          <li>Verificar identidad o edad y prevenir suplantación, abuso y fraude.</li>
          <li>Publicar y mostrar anuncios, solicitudes, comercios y datos de contacto.</li>
          <li>Facilitar el contacto entre usuarios, comercios y prestadores de servicios.</li>
          <li>Prestar soporte y enviar comunicaciones operativas o de seguridad.</li>
          <li>Moderar contenido y aplicar las reglas de la comunidad.</li>
          <li>Medir el uso, diagnosticar fallos, mantener y mejorar el servicio.</li>
          <li>Mostrar y medir publicidad cuando esté habilitada y exista la autorización requerida.</li>
          <li>Cumplir obligaciones legales y proteger derechos, personas y sistemas.</li>
        </ul>
      </section>

      <section>
        <h2>5. Uso de inteligencia artificial</h2>
        <p className="mt-2">
          Repuestos Mérida utiliza herramientas de inteligencia artificial para apoyar el
          desarrollo, las pruebas, el mantenimiento y el monitoreo técnico de la plataforma.
          También puede utilizarlas para prestar las siguientes funciones:
        </p>
        <ul className="mt-2">
          <li>
            <strong>Asistente de Plaza:</strong> las preguntas escritas por el usuario y una parte
            reciente de la conversación se envían a Anthropic para generar una respuesta mediante
            Claude.
          </li>
          <li>
            <strong>Monitoreo y moderación:</strong> el texto y las imágenes de una publicación
            pueden enviarse a Google Gemini para detectar contenido posiblemente ilícito,
            ofensivo, fraudulento o contrario a las reglas. Una marca de IA puede provocar revisión
            humana, limitación o retiro del contenido.
          </li>
          <li>
            <strong>Verificación de identidad o edad:</strong> en el flujo que lo indica, la foto
            de la cédula y la selfie se envían a Google Gemini para comprobar que el documento
            parezca válido, leer sus datos y verificar que la persona aparece sosteniéndolo. El
            resultado puede aprobar o rechazar inicialmente la verificación.
          </li>
          <li>
            <strong>Desarrollo y operación:</strong> herramientas asistidas por IA pueden ayudar a
            analizar código, configuración, diagnósticos y eventos técnicos para desarrollar,
            mantener, proteger y mejorar el servicio.
          </li>
        </ul>
        <p className="mt-2">
          La IA puede equivocarse. Si no estás de acuerdo con una decisión de moderación o
          verificación, puedes solicitar revisión humana escribiendo al correo de contacto. No
          incluyas contraseñas, códigos, datos bancarios ni otros datos sensibles en el asistente.
        </p>
        <p className="mt-2">
          Cuando una función usa IA externa, los datos necesarios se transmiten al proveedor para
          procesar la solicitud y quedan sujetos también a sus condiciones y prácticas de
          privacidad. Repuestos Mérida no presenta las respuestas de IA como asesoría profesional.
        </p>
      </section>

      <section>
        <h2>6. Información pública</h2>
        <p className="mt-2">
          Los anuncios, solicitudes y fichas de comercios están destinados a ser públicos. Según lo
          que publiques, pueden mostrar imágenes, descripción, precio, ubicación, nombre comercial
          y número de WhatsApp. No publiques información que no quieras hacer visible ni datos de
          otra persona sin autorización.
        </p>
      </section>

      <section>
        <h2>7. Proveedores y destinatarios</h2>
        <p className="mt-2">
          Usamos proveedores que procesan información para operar funciones concretas, entre ellos:
        </p>
        <ul className="mt-2">
          <li>Google Firebase para autenticación, bases de datos, almacenamiento e infraestructura.</li>
          <li>Google Gemini para las funciones de IA descritas en esta política.</li>
          <li>Anthropic Claude para el asistente conversacional de Plaza.</li>
          <li>Vercel para alojamiento, entrega del sitio y analítica web.</li>
          <li>Google AdSense o AdMob para publicidad, cuando estén habilitados.</li>
          <li>Google Maps u OpenStreetMap para funciones de mapas y ubicación.</li>
          <li>Google y WhatsApp para acceso, comunicación o enlaces iniciados por el usuario.</li>
        </ul>
        <p className="mt-2">
          También podremos divulgar información cuando sea razonablemente necesario para cumplir
          la ley, atender una orden válida, investigar fraude o incidentes de seguridad, o proteger
          los derechos y la integridad de usuarios, terceros y la plataforma.
        </p>
        <p className="mt-2">
          No vendemos listas de datos de registro o documentos de identidad. Los proveedores de
          publicidad y medición pueden procesar cookies, identificadores y datos técnicos conforme
          a la decisión de consentimiento del usuario y a sus propias políticas.
        </p>
      </section>

      <section>
        <h2>8. Cookies, analítica y publicidad</h2>
        <p className="mt-2">
          Utilizamos almacenamiento local y tecnologías necesarias para sesión, seguridad y
          preferencias. Las tecnologías opcionales de medición o publicidad se gestionan mediante
          el aviso de cookies cuando corresponde. Puedes consultar y cambiar tu decisión en la{' '}
          <a href="/politica-cookies">Política de Cookies</a>.
        </p>
      </section>

      <section>
        <h2>9. Conservación y eliminación</h2>
        <p className="mt-2">
          Conservamos los datos mientras la cuenta o publicación permanezca activa y durante el
          tiempo razonablemente necesario para prestar el servicio, resolver disputas, prevenir
          fraude, mantener seguridad o cumplir obligaciones legales. Los plazos varían según el
          tipo de información y las copias de respaldo.
        </p>
        <p className="mt-2">
          Las fotos de cédula y selfie enviadas para verificación se conservan en Firebase Storage
          privado como respaldo de la validación y para revisión administrativa. No se publican ni
          se entregan mediante una URL pública. Se mantienen mientras la verificación o la cuenta
          asociada continúe activa, o durante el tiempo necesario para prevenir fraude, atender
          reclamaciones y cumplir obligaciones aplicables. El proveedor de IA puede aplicar sus
          propios plazos técnicos conforme a sus condiciones.
        </p>
        <p className="mt-2">
          Puedes solicitar la eliminación de tu cuenta y datos mediante la página{' '}
          <a href="/eliminar-datos">Eliminar mis datos</a>. Algunas evidencias mínimas podrán
          conservarse cuando exista una obligación legal, un reclamo pendiente o una necesidad
          legítima de seguridad.
        </p>
      </section>

      <section>
        <h2>10. Seguridad</h2>
        <p className="mt-2">
          Aplicamos medidas técnicas y organizativas razonables, como controles de acceso,
          autenticación, validación de archivos y almacenamiento privado para documentos de
          verificación. Ningún sistema es completamente infalible, por lo que no podemos prometer
          seguridad absoluta.
        </p>
      </section>

      <section>
        <h2>11. Tus derechos y opciones</h2>
        <p className="mt-2">
          Puedes solicitar acceso, corrección o eliminación de tus datos, retirar un anuncio,
          cuestionar una decisión automatizada o pedir información sobre el tratamiento escribiendo
          a <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Verificaremos la
          identidad de quien realiza la solicitud antes de actuar.
        </p>
        <p className="mt-2">
          Si una ley de tu territorio te concede derechos adicionales, los atenderemos cuando
          resulte aplicable. Esto puede incluir oposición, limitación, portabilidad, retiro del
          consentimiento o presentación de una reclamación ante la autoridad competente.
        </p>
      </section>

      <section>
        <h2>12. Menores de edad</h2>
        <p className="mt-2">
          La plataforma completa, y especialmente las funciones de publicación y comercio, no está
          dirigida a menores de edad. Si detectamos que se recopilaron datos de un menor sin la
          autorización requerida, podremos restringir el acceso y eliminar la información.
        </p>
      </section>

      <section>
        <h2>13. Transferencias internacionales</h2>
        <p className="mt-2">
          Los proveedores tecnológicos pueden procesar datos en países distintos a Venezuela.
          Cuando una norma aplicable lo exija, procuraremos utilizar las salvaguardas contractuales
          o legales correspondientes.
        </p>
      </section>

      <section>
        <h2>14. Cambios a esta política</h2>
        <p className="mt-2">
          Podemos actualizar esta política cuando cambien las funciones, los proveedores o las
          obligaciones aplicables. Publicaremos la versión vigente con su fecha de actualización y,
          si el cambio es relevante, mostraremos un aviso adicional.
        </p>
      </section>
    </LegalPage>
  )
}
