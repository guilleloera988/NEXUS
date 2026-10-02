"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="centered"><div className="card"><span className="eyebrow">PAUSA INESPERADA</span><h1>No pudimos cargar esta vista.</h1><p>Tus datos guardados permanecen en el servidor. Intenta cargar nuevamente.</p><button className="button button-dark" onClick={reset}>Reintentar</button></div></main>}
