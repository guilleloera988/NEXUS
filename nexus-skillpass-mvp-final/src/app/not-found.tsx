import Link from "next/link";
export default function NotFound(){return <main className="centered"><div className="card"><span className="eyebrow">404 / RUTA NO DISPONIBLE</span><h1>No encontramos esta página.</h1><p>Revisa el enlace o vuelve a tu espacio de trabajo.</p><Link href="/" className="button button-dark">Volver al inicio ↗</Link></div></main>}
