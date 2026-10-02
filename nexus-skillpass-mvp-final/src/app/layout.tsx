import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:{default:"NEXUS SkillPass | Verified Skills Through Real Experience",template:"%s | NEXUS SkillPass"},description:"Convierte proyectos, retos y experiencias reales en habilidades respaldadas por evidencia y validación profesional.",openGraph:{title:"NEXUS SkillPass · Experiencia que se puede comprobar",description:"Experiencia aplicada, evidencia y validación humana. Powered by AINDEV TECH MÉXICO.",type:"website",locale:"es_MX"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
