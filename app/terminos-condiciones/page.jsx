import LegalPage from '@/app/components/LegalPage'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR_NAME,
  LEGAL_TRADE_NAME,
  TERMS_UPDATED_LABEL,
} from '@/lib/legalConfig'

export const metadata = {
  title: 'Términos y Condiciones | Repuestos Mérida',
  description:
    'Condiciones de uso de Repuestos Mérida para usuarios, comercios, publicaciones, solicitudes y contacto dentro de la plataforma.',
  alternates: { canonical: '/terminos-condiciones' },
}

export default function TerminosCondiciones() {
  return (
    <LegalPage title="Términos y Condiciones de Uso" updated={TERMS_UPDATED_LABEL}>
      <section>
        <h2>1. Aceptación</h2>
        <p className="mt-2">
          Estos términos regulan el uso del sitio web, la aplicación móvil y los servicios de
          Repuestos Mérida. Al crear una cuenta, publicar contenido o utilizar las funciones de la
          plataforma, aceptas estos términos y la Política de Privacidad. Si no estás de acuerdo, no
          debes utilizar los servicios.
        </p>
      </section>

      <section>
        <h2>2. Quiénes somos</h2>
        <p className="mt-2">
          Repuestos Mérida es operada por <strong>{LEGAL_OPERATOR_NAME}</strong>, persona natural,
          con base en Mérida, Venezuela. {LEGAL_TRADE_NAME} es el nombre comercial proyectado para
          un registro futuro y actualmente no es una sociedad mercantil constituida. Puedes
          contactarnos en <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2>3. Naturaleza del servicio</h2>
        <p className="mt-2">
          Repuestos Mérida ofrece un catálogo, un directorio, un espacio de anuncios y solicitudes,
          herramientas comunitarias y medios para facilitar el contacto entre usuarios, comercios y
          prestadores de servicios.
        </p>
        <p className="mt-2">
          Salvo que lo indiquemos expresamente, Repuestos Mérida no vende los productos publicados
          por terceros, no recibe pagos por ellos, no es empleador ni parte de sus contratos y no
          garantiza identidad, disponibilidad, calidad, legalidad, entrega o cumplimiento.
        </p>
      </section>

      <section>
        <h2>4. Cuentas, edad y seguridad</h2>
        <ul className="mt-2">
          <li>Debes suministrar información verdadera, actual y verificable.</li>
          <li>Eres responsable de proteger tus sesiones y códigos de acceso.</li>
          <li>No puedes suplantar a otra persona ni utilizar una cuenta ajena.</li>
          <li>
            Las funciones de publicación y comercio pueden exigir mayoría de edad, número de
            WhatsApp verificado y verificación de cédula.
          </li>
          <li>Debes avisarnos si sospechas de acceso no autorizado o uso indebido de tu cuenta.</li>
        </ul>
      </section>

      <section>
        <h2>5. Reglas de uso y contenido prohibido</h2>
        <p className="mt-2">No puedes utilizar la plataforma para:</p>
        <ul className="mt-2">
          <li>Cometer fraude, engañar, amenazar, acosar o causar daño.</li>
          <li>Ofrecer artículos robados, ilícitos, falsificados o de procedencia dudosa.</li>
          <li>Publicar armas, drogas, explotación sexual, documentos falsos o contenido ilegal.</li>
          <li>Difundir malware, spam, credenciales o mecanismos para vulnerar sistemas.</li>
          <li>Publicar datos personales de terceros sin una base legítima o su autorización.</li>
          <li>Infringir derechos de autor, marca, imagen, privacidad u otros derechos de terceros.</li>
          <li>Manipular reseñas, métricas, precios o la visibilidad de contenido.</li>
        </ul>
      </section>

      <section>
        <h2>6. Contenido del usuario</h2>
        <p className="mt-2">
          Conservas los derechos que tengas sobre el contenido que envías. Al publicarlo, concedes
          a Repuestos Mérida una licencia no exclusiva, gratuita y limitada a alojar, copiar,
          adaptar técnicamente, mostrar, distribuir y moderar ese contenido únicamente para operar,
          promocionar y mejorar la plataforma, mientras permanezca publicado y durante el tiempo
          técnicamente necesario para retirarlo de respaldos.
        </p>
        <p className="mt-2">
          Declaras que tienes los derechos y permisos necesarios para publicar el contenido,
          incluidas las imágenes y los datos de contacto, y que este es exacto y lícito. Eres
          responsable de lo que publicas y de las consecuencias de hacerlo público.
        </p>
      </section>

      <section>
        <h2>7. Moderación y retiro</h2>
        <p className="mt-2">
          Podemos revisar, corregir formato, limitar, rechazar, ocultar o retirar contenido, así
          como suspender funciones o cuentas, cuando consideremos razonablemente que incumple estos
          términos, expone a la comunidad a riesgo o afecta el servicio. La moderación no significa
          que aprobemos, garanticemos o asumamos responsabilidad por todo el contenido publicado.
        </p>
        <p className="mt-2">
          Aplicamos una política contra infractores reincidentes. Podemos suspender o terminar
          cuentas que acumulen reclamaciones fundadas de propiedad intelectual o que reiteradamente
          publiquen contenido ilícito.
        </p>
      </section>

      <section>
        <h2>8. Inteligencia artificial</h2>
        <p className="mt-2">
          La plataforma informa que utiliza herramientas de inteligencia artificial para apoyar el
          desarrollo, las pruebas, el mantenimiento, el monitoreo técnico, la seguridad, el
          asistente de Plaza, la moderación de publicaciones y determinadas verificaciones de
          identidad o edad.
        </p>
        <p className="mt-2">
          Dependiendo de la función, mensajes, texto, imágenes, diagnósticos o fotos de verificación
          pueden procesarse mediante proveedores externos como Anthropic Claude o Google Gemini. La
          IA puede generar resultados incorrectos, incompletos o desactualizados. No debes
          interpretar sus respuestas como asesoría legal, médica, financiera, mecánica u otra
          asesoría profesional.
        </p>
        <p className="mt-2">
          Una señal de IA puede someter contenido a revisión, limitarlo o producir un resultado
          inicial de verificación. Puedes solicitar revisión humana mediante el correo de contacto.
          Consulta la <a href="/politica-privacidad">Política de Privacidad</a> para conocer los
          datos y proveedores involucrados.
        </p>
      </section>

      <section>
        <h2>9. Propiedad intelectual y avisos de infracción</h2>
        <p className="mt-2">
          El diseño, el software y los contenidos propios pertenecen a {LEGAL_OPERATOR_NAME} o se
          utilizan con autorización. Repuestos Mérida y {LEGAL_TRADE_NAME} son nombres comerciales
          utilizados por el operador, sin que esta declaración sustituya un registro de marca. Las
          marcas y contenidos de terceros pertenecen a sus respectivos titulares.
        </p>
        <p className="mt-2">
          Si consideras que un contenido infringe tus derechos, envía a{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> una identificación de la
          obra o derecho afectado, la URL o ubicación exacta del material, tus datos de contacto,
          una explicación de la reclamación y una declaración de buena fe sobre tu autorización
          para actuar. Revisaremos los avisos completos y podremos retirar o deshabilitar el
          contenido mientras se resuelve la reclamación.
        </p>
        <p className="mt-2">
          Esta vía de contacto no significa por sí sola que Repuestos Mérida haya completado una
          designación de agente ante una autoridad extranjera. Consulta el procedimiento completo
          en la <a href="/propiedad-intelectual">Política de Propiedad Intelectual y Retiro</a>.
        </p>
      </section>

      <section>
        <h2>10. Transacciones y contacto con terceros</h2>
        <p className="mt-2">
          Antes de pagar, entregar un artículo, acudir a un lugar o compartir información adicional,
          debes verificar por tu cuenta la identidad de la contraparte, el estado del producto, la
          ubicación, el precio, la disponibilidad, la garantía y las condiciones de la operación.
          Nunca compartas contraseñas, códigos de verificación o datos bancarios sensibles por un
          anuncio o por el asistente.
        </p>
      </section>

      <section>
        <h2>11. Obligaciones legales, tributarias y administrativas de los comercios</h2>
        <p className="mt-2">
          A los efectos de esta sección, se considera comercio a toda persona natural o jurídica
          que publique, anuncie, ofrezca o venda bienes o servicios mediante la plataforma. Cada
          comercio desarrolla su actividad de forma independiente, por su propia cuenta y riesgo,
          y es el único responsable de sus productos, precios, ventas, cobros, facturación,
          entregas, garantías y atención al consumidor. Salvo indicación expresa en contrario,
          Repuestos Mérida no representa al comercio ni participa como vendedor, proveedor,
          mandatario, agente, socio o contribuyente en sus operaciones.
        </p>
        <p className="mt-2">
          Corresponde exclusivamente a cada comercio identificar y cumplir las obligaciones que le
          resulten aplicables conforme a su actividad, ubicación, forma jurídica y condición
          tributaria. Esto incluye, cuando corresponda:
        </p>
        <ul className="mt-2">
          <li>
            Inscribirse ante el SENIAT, mantener actualizados los datos del Registro Único de
            Información Fiscal (RIF) y suministrar a la plataforma información fiscal verdadera,
            vigente y verificable.
          </li>
          <li>
            Reflejar su número de RIF en facturas, contratos, libros, documentos, etiquetas,
            empaques y anuncios difundidos por medios de comunicación masiva o digital en todos
            los casos exigidos por la normativa vigente.
          </li>
          <li>
            Emitir, entregar y conservar facturas y demás documentos fiscales mediante los medios
            autorizados; llevar los libros y registros requeridos; presentar declaraciones y
            cumplir pagos, retenciones y demás deberes tributarios formales o materiales.
          </li>
          <li>
            Obtener y conservar registros mercantiles, licencias de actividad económica,
            patentes, permisos municipales, sanitarios, laborales, de seguridad, ambientales o
            sectoriales que correspondan.
          </li>
          <li>
            Respetar las normas sobre precios, información y publicidad, procedencia y
            autenticidad de la mercancía, calidad, seguridad, cambios, garantías y demás derechos
            de consumidores y usuarios.
          </li>
        </ul>
        <p className="mt-2">
          La creación o aprobación de una cuenta, la publicación de un producto, la aparición en
          el directorio, la verificación de identidad o ubicación y cualquier distintivo de
          “comercio autorizado” significan únicamente que se cumplieron los controles internos de
          la plataforma. No constituyen inscripción mercantil o fiscal, licencia, solvencia,
          certificación de cumplimiento ni autorización del SENIAT, de la administración
          tributaria municipal, de la SUNDDE o de otra autoridad; tampoco sustituyen la asesoría
          legal o contable, la facturación ni los trámites que correspondan al comercio.
        </p>
        <p className="mt-2">
          El simple uso de Repuestos Mérida no altera la condición tributaria del comercio ni
          constituye por sí solo una infracción; tampoco concede exención, inmunidad o garantía de
          que no será fiscalizado o sancionado. Solo las autoridades competentes pueden determinar
          incumplimientos y aplicar sanciones. El comercio asume las inspecciones, requerimientos,
          reparos, tributos, intereses, multas, cierres, comisos, reclamaciones y demás
          consecuencias que deriven de sus propios actos u omisiones, de la información que
          publique o de su incumplimiento legal.
        </p>
        <p className="mt-2">
          En la medida permitida por la ley, Repuestos Mérida y su operador no responden por esas
          consecuencias ni por daños o reclamaciones imputables al comercio. El comercio deberá
          mantenerlos indemnes y reembolsar los gastos razonables derivados de reclamaciones de
          terceros o actuaciones de autoridades atribuibles a su actividad, contenido o
          incumplimiento. Esta asignación de responsabilidad opera únicamente entre el comercio y
          Repuestos Mérida, no es oponible a las autoridades y no excluye actos propios de la
          plataforma, dolo, culpa grave, responsabilidades legalmente ineludibles ni derechos
          irrenunciables de consumidores y usuarios.
        </p>
      </section>

      <section>
        <h2>12. Publicidad, promociones y servicios externos</h2>
        <p className="mt-2">
          La plataforma puede mostrar anuncios, publicaciones destacadas, enlaces o funciones de
          terceros. Estos pueden estar sujetos a condiciones adicionales. La aparición de un
          tercero no constituye una garantía o recomendación salvo que se indique expresamente.
        </p>
      </section>

      <section>
        <h2>13. Disponibilidad y cambios</h2>
        <p className="mt-2">
          Podemos corregir, actualizar, suspender o retirar funciones por mantenimiento, seguridad,
          cumplimiento o razones operativas. No garantizamos disponibilidad continua ni que toda
          información de terceros permanezca exacta o actualizada.
        </p>
      </section>

      <section>
        <h2>14. Limitación de responsabilidad</h2>
        <p className="mt-2">
          En la medida permitida por la ley aplicable, Repuestos Mérida y su operador no responden
          por acuerdos, pagos, entregas, garantías, pérdidas, fraude, daños o conflictos entre
          usuarios y terceros, ni por decisiones tomadas basándose exclusivamente en contenido de
          usuarios o resultados de inteligencia artificial.
        </p>
        <p className="mt-2">
          Nada en estos términos excluye responsabilidades que legalmente no puedan limitarse ni
          derechos irrenunciables del consumidor.
        </p>
      </section>

      <section>
        <h2>15. Suspensión o terminación</h2>
        <p className="mt-2">
          Podemos suspender, limitar o terminar el acceso por fraude, suplantación, riesgos de
          seguridad, infracción reiterada, incumplimiento de estos términos o perjuicio a la
          plataforma o a terceros. El usuario puede dejar de usar el servicio y solicitar la
          eliminación de sus datos conforme a la Política de Privacidad.
        </p>
      </section>

      <section>
        <h2>16. Legislación y resolución de disputas</h2>
        <p className="mt-2">
          Estos términos se interpretan conforme a las leyes de la República Bolivariana de
          Venezuela, sin perjuicio de las normas imperativas que protejan a usuarios de otros
          territorios. Antes de iniciar una reclamación formal, las partes procurarán resolverla de
          buena fe mediante el correo de contacto.
        </p>
        <p className="mt-2">
          Estos términos no establecen actualmente arbitraje obligatorio ni renuncia a acciones
          colectivas. Una cláusula de ese tipo solo se incorporará después de definir reglas,
          institución, sede, costos, alcance y mecanismo válido de aceptación.
        </p>
      </section>

      <section>
        <h2>17. Cambios a estos términos</h2>
        <p className="mt-2">
          Podemos actualizar estos términos para reflejar cambios legales o del servicio.
          Publicaremos la versión vigente con su fecha y, si el cambio es material, mostraremos un
          aviso adicional o solicitaremos nueva aceptación cuando corresponda.
        </p>
      </section>
    </LegalPage>
  )
}
