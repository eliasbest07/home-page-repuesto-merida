import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="myComponent">
        <h2>Repuestos Mérida Aplicación móvil. </h2>
        <Image alt="icono aplicación" src={"/iconorm.png"} width={360} height={360} ></Image>
        <br/>
        <br/>
        <Link style={{color: 'blue', textDecoration: 'underline'}}  href="politica-privacidad">Política de Privacidad</Link>
        <br/>
        <Link  style={{color: 'blue', textDecoration: 'underline'}}  href="eliminar-datos">Derecho a la eliminación de cuenta y datos</Link>
        <br/>
        <Link style={{color: 'blue', textDecoration: 'underline'}}  href="terminos-condiciones">Términos y Condiciones de uso.</Link>
        <br/>
        <br/>
        <h2> Gochos&apos; Group </h2>
        <Image alt="logo Gochos Group" src={"/gochosgroup.png"} width={512} height={512} ></Image>
      </div>
    </main>
  )
}
