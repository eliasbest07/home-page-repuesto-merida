import LegalPage from '@/app/components/LegalPage'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR_NAME,
  LEGAL_TRADE_NAME,
  LEGAL_UPDATED_LABEL,
} from '@/lib/legalConfig'

export const metadata = {
  title: 'Aviso Legal | Repuestos Mérida',
  description: 'Información legal, titularidad y condiciones de uso de Repuestos Mérida.',
  alternates: { canonical: '/aviso-legal' },
}

export default function AvisoLegal() {
  return (
    <LegalPage title="Aviso Legal" updated={LEGAL_UPDATED_LABEL}>
      <section>
        <h2>1. Titular del sitio</h2>
        <p className="mt-2">
          Este sitio web, disponible en repuestosmerida.com, es operado por{' '}
          <strong>{LEGAL_OPERATOR_NAME}</strong>, persona natural, bajo el nombre Repuestos Mérida,
          con domicilio de actividad en Mérida centro, Av. 3, Mérida, Venezuela.
        </p>
        <p className="mt-2">
          {LEGAL_TRADE_NAME} es el nombre comercial proyectado para un registro futuro en
          Venezuela. Actualmente no se presenta como una sociedad mercantil constituida ni como una
          persona jurídica independiente.
        </p>
        <p className="mt-2">
          Horario de atención: todos los días de 8:00 a. m. a 8:00 p. m.
        </p>
        <p className="mt-2">
          Contacto: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2>2. Objeto del sitio</h2>
        <p className="mt-2">
          Repuestos Mérida ofrece información y herramientas para consultar repuestos, publicar
          anuncios y facilitar el contacto entre usuarios, comercios y prestadores de servicios.
          Salvo indicación expresa, Repuestos Mérida no es el vendedor de los productos publicados
          por terceros.
        </p>
      </section>

      <section>
        <h2>3. Responsabilidad del usuario</h2>
        <p className="mt-2">
          El usuario debe utilizar el sitio de forma lícita, suministrar información veraz y
          verificar precios, disponibilidad, identidad del vendedor, condiciones de pago, entrega y
          garantía antes de realizar cualquier operación.
        </p>
      </section>

      <section>
        <h2>4. Limitación de responsabilidad</h2>
        <p className="mt-2">
          No garantizamos que el sitio esté disponible sin interrupciones ni que toda información
          publicada por terceros sea exacta o permanezca actualizada. Repuestos Mérida no responde
          por acuerdos, pagos, entregas, garantías o conflictos entre usuarios y anunciantes.
        </p>
      </section>

      <section>
        <h2>5. Propiedad intelectual</h2>
        <p className="mt-2">
          El diseño, el software y los contenidos propios del sitio pertenecen a{' '}
          {LEGAL_OPERATOR_NAME} o se utilizan con autorización. Repuestos Mérida y{' '}
          {LEGAL_TRADE_NAME} son nombres comerciales utilizados por el operador, sin que esta
          declaración sustituya un registro de marca. Las marcas, fotografías y contenidos de
          terceros pertenecen a sus respectivos titulares.
        </p>
      </section>

      <section>
        <h2>6. Enlaces y servicios externos</h2>
        <p className="mt-2">
          El sitio puede enlazar a páginas o utilizar servicios de terceros, incluidos Google,
          Firebase, WhatsApp y proveedores de mapas. Cada proveedor aplica sus propias condiciones y
          políticas.
        </p>
      </section>

      <section>
        <h2>7. Legislación aplicable</h2>
        <p className="mt-2">
          Este aviso se interpreta conforme a las leyes de la República Bolivariana de Venezuela,
          sin perjuicio de las normas imperativas que resulten aplicables a usuarios de otros
          territorios.
        </p>
      </section>
    </LegalPage>
  )
}
