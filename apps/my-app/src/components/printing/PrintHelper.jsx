import { toast } from "sonner";

export const printInNewWindow = (receiptHTML) => {
  try {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      // Bloqueador de pop-ups activo, usar iframe como fallback
      toast.error("⚠️ Desbloquea los pop-ups para imprimir");
      printWithIframe(receiptHTML);
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
          }
        </style>
      </head>
      <body>
        ${receiptHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  } catch (error) {
    console.error("Error opening print window:", error);
    toast.error("Error al abrir ventana de impresión");
    printWithIframe(receiptHTML);
  }
};

// Fallback: usar iframe oculto
const printWithIframe = (receiptHTML) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        
        body {
          margin: 0;
          padding: 0;
          font-family: 'Courier New', monospace;
        }
      </style>
    </head>
    <body>
      ${receiptHTML}
    </body>
    </html>
  `);
  doc.close();
  
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
  };
};
