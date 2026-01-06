/**
 * Detecta URLs en texto y las convierte en links clickeables
 * Soporta http://, https://, www. y dominios directos
 */

const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;

export function detectLinks(text) {
  if (!text || typeof text !== 'string') return [];
  
  const matches = text.match(URL_REGEX) || [];
  return matches.map(url => {
    let normalizedUrl = url.trim();
    
    // Si no tiene protocolo, añadir https://
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // Validar que sea una URL real
    try {
      const urlObj = new URL(normalizedUrl);
      if (['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          original: url,
          normalized: normalizedUrl
        };
      }
    } catch {
      return null;
    }
    
    return null;
  }).filter(Boolean);
}

export function linkifyText(text) {
  if (!text || typeof text !== 'string') return text;
  
  const links = detectLinks(text);
  if (links.length === 0) return text;
  
  let result = text;
  links.forEach(({ original, normalized }) => {
    const linkHtml = `<a href="${normalized}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline cursor-pointer">${original}</a>`;
    result = result.replace(original, linkHtml);
  });
  
  return result;
}

export function LinkifiedText({ text, className = "" }) {
  if (!text) return null;
  
  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX);
  let match;
  
  const textCopy = String(text);
  
  while ((match = regex.exec(textCopy)) !== null) {
    // Texto antes del link
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: textCopy.substring(lastIndex, match.index)
      });
    }
    
    // El link
    let url = match[0];
    let normalizedUrl = url;
    
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // Validar URL
    try {
      const urlObj = new URL(normalizedUrl);
      if (['http:', 'https:'].includes(urlObj.protocol)) {
        parts.push({
          type: 'link',
          content: url,
          href: normalizedUrl
        });
      } else {
        parts.push({
          type: 'text',
          content: url
        });
      }
    } catch {
      parts.push({
        type: 'text',
        content: url
      });
    }
    
    lastIndex = regex.lastIndex;
  }
  
  // Texto después del último link
  if (lastIndex < textCopy.length) {
    parts.push({
      type: 'text',
      content: textCopy.substring(lastIndex)
    });
  }
  
  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }
  
  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.type === 'link') {
          return (
            <a
              key={idx}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline cursor-pointer font-medium"
              onClick={(e) => {
                e.stopPropagation();
                // Doble verificación de seguridad
                try {
                  const url = new URL(part.href);
                  if (!['http:', 'https:'].includes(url.protocol)) {
                    e.preventDefault();
                    alert('Solo se permiten URLs con protocolo HTTP o HTTPS');
                  }
                } catch {
                  e.preventDefault();
                  alert('URL inválida');
                }
              }}
            >
              {part.content}
            </a>
          );
        }
        return <span key={idx}>{part.content}</span>;
      })}
    </span>
  );
}
