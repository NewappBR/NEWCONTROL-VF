
import React from 'react';

interface LogoProps {
  src?: string;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ src, className = "w-full h-full" }) => {
  if (src) {
    return <img src={src} alt="Logo" className={`${className} object-contain`} />;
  }

  // LOGO CONCEITUAL "NEWCOM CONTROL"
  // Design geométrico abstrato representando precisão, controle e fluxo industrial.
  return (
    <svg 
        className={className} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
    >
        {/* Fundo Hexagonal Sutil */}
        <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" fill="currentColor" fillOpacity="0.1" />
        
        {/* Elemento Central - N Estilizado / Fluxo */}
        <path 
            d="M7 8V16L12 13V8L17 11V16" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
        />
        
        {/* Pontos de Conexão/Controle */}
        <circle cx="7" cy="16" r="1.5" fill="currentColor" />
        <circle cx="17" cy="8" r="1.5" fill="currentColor" />
        <circle cx="12" cy="22" r="1" fill="currentColor" fillOpacity="0.5" />
        <circle cx="12" cy="2" r="1" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
};

export default Logo;
