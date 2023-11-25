import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="myComponent">
        <h1>Repuestos Mérida Aplicación móvil. </h1>
        <Image alt="icono aplicación" src={"/iconorm.png"} width={360} height={360} ></Image>
        <Link href="politica-privacidad">Política de Privacidad</Link>
        <br/>
        <Link href="eliminar-datos">Derecho a la eliminación de cuenta y datos</Link>
      </div>
    </main>
  )
}
