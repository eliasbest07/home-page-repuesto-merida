import LegalPage from '@/app/components/LegalPage'

export const metadata = {
  title: 'Aviso Legal | Repuestos Mérida',
  description: 'Información legal, titularidad y condiciones de uso de Repuestos Mérida.',
}

export default function AvisoLegal() {
  return (
    <LegalPage title="Aviso Legal" updated="10 de junio de 2026">
      <section>
        <h2>1. Titular del sitio</h2>
        <p className="mt-2">
          Este sitio web, disponible en repuestosmerida.com, es operado por Gochos&apos; Group bajo
          el nombre Repuestos Mérida, con domicilio de actividad en Mérida, Venezuela.
        </p>
        <p className="mt-2">
          Contacto: <a href="mailto:ahoraesbest@gmail.com">ahoraesbest@gmail.com</a>.
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
          La marca, el diseño, el software y los contenidos propios del sitio pertenecen a
          Gochos&apos; Group o se utilizan con autorización. Las marcas, fotografías y contenidos de
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
