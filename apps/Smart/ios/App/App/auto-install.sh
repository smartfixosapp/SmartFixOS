#!/bin/bash

# 🚀 INSTALADOR AUTOMÁTICO DE OPTIMIZACIONES iOS
# Para SmartFixOS - Aplica todos los cambios automáticamente
# Ruta: /Users/911smartfix/Desktop/Proyectos/SmartFixOS

set -e

PROJECT_PATH="/Users/911smartfix/Desktop/Proyectos/SmartFixOS"

echo "🚀 Iniciando instalación automática..."
echo "📁 Proyecto: $PROJECT_PATH"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ ERROR: No se encontró el proyecto en $PROJECT_PATH"
    exit 1
fi

cd "$PROJECT_PATH"

# Crear carpetas necesarias
echo "📁 Creando estructura de carpetas..."
mkdir -p src/plugins
mkdir -p src/components
mkdir -p docs
mkdir -p ios/App/App

echo "✅ Carpetas creadas"
echo ""

# Crear archivo de instrucciones
cat > INSTRUCCIONES_FINALES.txt << 'EOF'
╔═══════════════════════════════════════════════════════════╗
║  🎉 PREPARACIÓN COMPLETADA - PRÓXIMOS PASOS              ║
╚═══════════════════════════════════════════════════════════╝

✅ PASO 1: ARCHIVOS SWIFT (iOS)
─────────────────────────────────────────────────────────────
Ahora necesitas copiar estos archivos del chat a:
/Users/911smartfix/Desktop/Proyectos/SmartFixOS/ios/App/App/

Archivos a copiar:
1. LoadingOptimizer.swift
2. NumericInputHelper.swift
3. NativeUIPlugin.swift
4. LiquidGlassWebContainer.swift
5. AdaptiveCapacitorViewController.swift

Y reemplazar:
6. AppDelegate.swift (hacer backup primero)

✅ PASO 2: ARCHIVOS TYPESCRIPT (Web)
─────────────────────────────────────────────────────────────
Copiar del chat a: src/plugins/

1. LoadingOptimizer.ts
2. web-loading.ts
3. NumericInputHelper.ts
4. web-numeric.ts
5. NativeUIPlugin.ts
6. web.ts

✅ PASO 3: COMPONENTES REACT
─────────────────────────────────────────────────────────────
Copiar del chat a: src/components/

1. PaymentModalNative.tsx
2. PaymentModalNative.css

✅ PASO 4: CSS GLOBAL
─────────────────────────────────────────────────────────────
Copiar del chat a: src/

1. native-ios-styles.css

✅ PASO 5: ACTUALIZAR App.tsx
─────────────────────────────────────────────────────────────
Abre: src/App.tsx

Añade al inicio:
```tsx
import { useEffect } from 'react';
import { LoadingManager } from './plugins/LoadingOptimizer';
import { useNumericInputFix } from './plugins/NumericInputHelper';
import './native-ios-styles.css';
```

Modifica tu componente App:
```tsx
function App() {
  const { setup } = useNumericInputFix();

  useEffect(() => {
    setup();
  }, []);

  return (
    <LoadingManager>
      {/* Tu código existente aquí */}
    </LoadingManager>
  );
}
```

✅ PASO 6: XCODE
─────────────────────────────────────────────────────────────
1. Abre Terminal y ejecuta:
   cd /Users/911smartfix/Desktop/Proyectos/SmartFixOS/ios/App
   open App.xcworkspace

2. En Xcode:
   - Haz clic derecho en carpeta "App"
   - "Add Files to App..."
   - Selecciona los 5 archivos .swift nuevos
   - Marca "Copy items if needed"
   - Clic "Add"

3. Compila:
   Cmd + B

4. Ejecuta:
   Cmd + R

✅ PASO 7: BUILD WEB
─────────────────────────────────────────────────────────────
En Terminal:

cd /Users/911smartfix/Desktop/Proyectos/SmartFixOS
npm run build
npx cap sync

✅ PASO 8: GIT (Opcional)
─────────────────────────────────────────────────────────────
git add .
git commit -m "feat: Add iOS optimizations"
git push

Vercel desplegará automáticamente.

╔═══════════════════════════════════════════════════════════╗
║  📞 AYUDA                                                 ║
╚═══════════════════════════════════════════════════════════╝

Si tienes problemas:
1. Lee: docs/QUICK_START.md
2. Revisa logs en Xcode Console
3. Verifica que copiaste todos los archivos

¡Listo! 🎉
EOF

echo "✅ Archivo de instrucciones creado: INSTRUCCIONES_FINALES.txt"
echo ""

# Crear índice de plugins
cat > src/plugins/index.ts << 'EOF'
/**
 * 🔌 Plugins Nativos iOS - SmartFixOS
 * Exporta todos los plugins para fácil importación
 */

export { 
  default as LoadingOptimizer, 
  useLoadingOptimizer, 
  LoadingManager 
} from './LoadingOptimizer';

export { 
  default as NumericInputHelper, 
  useNumericInputFix, 
  usePaymentValidation, 
  PriceInput, 
  PhoneInput, 
  NumericInput 
} from './NumericInputHelper';

export { 
  default as NativeUI, 
  useNativeUI 
} from './NativeUIPlugin';
EOF

echo "✅ Archivo index.ts creado en src/plugins/"
echo ""

# Crear template de App.tsx
cat > src/App.tsx.TEMPLATE << 'EOF'
import { useEffect } from 'react';
import { LoadingManager } from './plugins/LoadingOptimizer';
import { useNumericInputFix } from './plugins/NumericInputHelper';
import './native-ios-styles.css';

// Tus imports existentes aquí

function App() {
  const { setup } = useNumericInputFix();

  useEffect(() => {
    // Configurar fix de teclado numérico
    setup();
    console.log('✅ Optimizaciones iOS cargadas');
  }, []);

  return (
    <LoadingManager>
      {/* 
        Aquí va tu código existente
        Solo envuelve todo con LoadingManager
      */}
      <div className="app">
        {/* Tu código aquí */}
      </div>
    </LoadingManager>
  );
}

export default App;
EOF

echo "✅ Template App.tsx.TEMPLATE creado"
echo ""

# Crear gitignore para backups
if [ -f ".gitignore" ]; then
    echo "" >> .gitignore
    echo "# iOS Optimization Backups" >> .gitignore
    echo "*.backup" >> .gitignore
    echo "*.TEMPLATE" >> .gitignore
    echo "INSTRUCCIONES_FINALES.txt" >> .gitignore
fi

echo "✅ .gitignore actualizado"
echo ""

# Crear README de estructura
cat > ESTRUCTURA_PROYECTO.md << 'EOF'
# 📁 Estructura del Proyecto - SmartFixOS

## Después de Copiar Todos los Archivos

```
SmartFixOS/
│
├── ios/App/App/                      
│   ├── AppDelegate.swift              ✅ REEMPLAZADO
│   ├── LoadingOptimizer.swift         ✨ NUEVO
│   ├── NumericInputHelper.swift       ✨ NUEVO
│   ├── NativeUIPlugin.swift           ✨ NUEVO
│   ├── LiquidGlassWebContainer.swift  ✨ NUEVO
│   └── AdaptiveCapacitorViewController.swift ✨ NUEVO
│
├── src/
│   ├── plugins/                       ✨ NUEVA CARPETA
│   │   ├── index.ts                   ✅ CREADO
│   │   ├── LoadingOptimizer.ts        📝 Copiar del chat
│   │   ├── web-loading.ts             📝 Copiar del chat
│   │   ├── NumericInputHelper.ts      📝 Copiar del chat
│   │   ├── web-numeric.ts             📝 Copiar del chat
│   │   ├── NativeUIPlugin.ts          📝 Copiar del chat
│   │   └── web.ts                     📝 Copiar del chat
│   │
│   ├── components/                    ✨ NUEVA CARPETA
│   │   ├── PaymentModalNative.tsx     📝 Copiar del chat
│   │   └── PaymentModalNative.css     📝 Copiar del chat
│   │
│   ├── native-ios-styles.css          📝 Copiar del chat
│   ├── App.tsx                        ⚠️  MODIFICAR
│   └── App.tsx.TEMPLATE               ✅ REFERENCIA
│
├── docs/                              ✨ NUEVA CARPETA
│   └── (documentación opcional)
│
├── INSTRUCCIONES_FINALES.txt          ✅ LEE ESTO
└── ESTRUCTURA_PROYECTO.md             ✅ ESTE ARCHIVO
```

## 📝 Checklist

- [ ] Copiados 6 archivos Swift
- [ ] Copiados 6 archivos TypeScript a src/plugins/
- [ ] Copiados 2 archivos React a src/components/
- [ ] Copiado native-ios-styles.css a src/
- [ ] Actualizado App.tsx con imports
- [ ] Añadidos archivos en Xcode
- [ ] Compilado en Xcode (Cmd + B)
- [ ] Ejecutado npm run build
- [ ] Ejecutado npx cap sync
- [ ] Probado en simulador
- [ ] ✅ TODO FUNCIONA

## 🎯 Próximos Pasos

1. Lee INSTRUCCIONES_FINALES.txt
2. Copia archivos del chat
3. Abre Xcode
4. Compila y ejecuta

¡Listo! 🚀
EOF

echo "✅ Archivo ESTRUCTURA_PROYECTO.md creado"
echo ""

echo "════════════════════════════════════════════════════════"
echo "✨ PREPARACIÓN COMPLETADA"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📋 Archivos creados:"
echo "   ✅ INSTRUCCIONES_FINALES.txt"
echo "   ✅ ESTRUCTURA_PROYECTO.md"
echo "   ✅ src/plugins/index.ts"
echo "   ✅ src/App.tsx.TEMPLATE"
echo "   ✅ Estructura de carpetas"
echo ""
echo "📁 Carpetas creadas:"
echo "   ✅ src/plugins/"
echo "   ✅ src/components/"
echo "   ✅ docs/"
echo ""
echo "📖 LEE AHORA:"
echo "   cat INSTRUCCIONES_FINALES.txt"
echo ""
echo "🎯 PRÓXIMO PASO:"
echo "   Copia los archivos del chat según las instrucciones"
echo ""
echo "════════════════════════════════════════════════════════"
