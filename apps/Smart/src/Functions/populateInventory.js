import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * ⚠️ DEVELOPMENT FUNCTION - SEED ONLY
 * This function populates the inventory with sample iPhone parts.
 * Should only be used during initial setup or development.
 * NEVER run in production without explicit verification.
 */

export default async function handler(req) {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();
    
    if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Definición de Modelos (Force Redeploy)
    const MODELS = [
        // 11 Series
        { name: "iPhone 11", family: "iPhone 11 Series", port: "Lightning", screenType: "LCD" },
        { name: "iPhone 11 Pro", family: "iPhone 11 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 11 Pro Max", family: "iPhone 11 Series", port: "Lightning", screenType: "OLED" },
        // 12 Series
        { name: "iPhone 12", family: "iPhone 12 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 12 Mini", family: "iPhone 12 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 12 Pro", family: "iPhone 12 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 12 Pro Max", family: "iPhone 12 Series", port: "Lightning", screenType: "OLED" },
        // 13 Series
        { name: "iPhone 13", family: "iPhone 13 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 13 Mini", family: "iPhone 13 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 13 Pro", family: "iPhone 13 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 13 Pro Max", family: "iPhone 13 Series", port: "Lightning", screenType: "OLED" },
        // 14 Series
        { name: "iPhone 14", family: "iPhone 14 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 14 Plus", family: "iPhone 14 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 14 Pro", family: "iPhone 14 Series", port: "Lightning", screenType: "OLED" },
        { name: "iPhone 14 Pro Max", family: "iPhone 14 Series", port: "Lightning", screenType: "OLED" },
        // 15 Series (USB-C)
        { name: "iPhone 15", family: "iPhone 15 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 15 Plus", family: "iPhone 15 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 15 Pro", family: "iPhone 15 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 15 Pro Max", family: "iPhone 15 Series", port: "USB-C", screenType: "OLED" },
        // 16 Series (USB-C)
        { name: "iPhone 16", family: "iPhone 16 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 16 Plus", family: "iPhone 16 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 16 Pro", family: "iPhone 16 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 16 Pro Max", family: "iPhone 16 Series", port: "USB-C", screenType: "OLED" },
        // 17 Series (Futuro - USB-C)
        { name: "iPhone 17", family: "iPhone 17 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 17 Plus", family: "iPhone 17 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 17 Pro", family: "iPhone 17 Series", port: "USB-C", screenType: "OLED" },
        { name: "iPhone 17 Pro Max", family: "iPhone 17 Series", port: "USB-C", screenType: "OLED" },
    ];

    // Definición de Piezas Genéricas
    const PART_TEMPLATES = [
        // --- Pantalla y Visual ---
        { suffix: "Pantalla Completa (Premium)", category: "screen", partType: "Pantalla", notes: "Calidad Original. Requiere programador para TrueTone.", baseCost: 80, basePrice: 150 },
        { suffix: "Pantalla Completa (Standard)", category: "screen", partType: "Pantalla", notes: "Calidad Compatible. Opción económica.", baseCost: 40, basePrice: 90 },
        { suffix: "Vidrio Frontal (Glass Only)", category: "screen", partType: "Vidrio", notes: "Solo para remanufactura. Requiere laminación.", baseCost: 10, basePrice: 25 },
        { suffix: "Marco de Pantalla (Frame)", category: "other", partType: "Marco", notes: "Bisel plástico/metálico intermedio.", baseCost: 5, basePrice: 15 },
        
        // --- Energía ---
        { suffix: "Batería (Alta Capacidad)", category: "battery", partType: "Batería", notes: "Requiere trasplante de BMS en modelos recientes para condición de salud.", baseCost: 20, basePrice: 60 },
        { suffix: "Adhesivo de Batería", category: "other", partType: "Sello", notes: "Tiras adhesivas de extracción.", baseCost: 1, basePrice: 5 },
        
        // --- Carga y Conectividad ---
        { 
            suffix: "Puerto de Carga (Flex Completo)", 
            category: "other", 
            partType: "Puerto de Carga", 
            notes: (m) => `Conector ${m.port}. Incluye micrófono inferior y antena primaria.`, 
            baseCost: 15, 
            basePrice: 45 
        },
        { suffix: "Antena WiFi/Bluetooth", category: "other", partType: "Antena", notes: "Flex de señal superior.", baseCost: 8, basePrice: 25 },
        
        // --- Cámaras ---
        { suffix: "Cámara Trasera (Módulo)", category: "other", partType: "Cámara Trasera", notes: "Módulo principal. Puede requerir configuración de sistema.", baseCost: 60, basePrice: 120 },
        { suffix: "Lente de Cámara (Cristal)", category: "other", partType: "Lente", notes: "Cristal externo del housing.", baseCost: 5, basePrice: 20 },
        { suffix: "Cámara Frontal", category: "other", partType: "Cámara Frontal", notes: "Componente visual solamente. No reemplaza FaceID.", baseCost: 25, basePrice: 60 },
        
        // --- Audio ---
        { suffix: "Speaker Inferior (Altavoz)", category: "other", partType: "Speaker", notes: "Módulo de altavoz principal.", baseCost: 12, basePrice: 35 },
        { suffix: "Earpiece (Auricular Superior)", category: "other", partType: "Earpiece", notes: "Bocina de llamadas. A veces integrado con flex de sensores.", baseCost: 10, basePrice: 30 },
        
        // --- Botones y Sensores ---
        { suffix: "Flex Botones Power/Volumen", category: "other", partType: "Flex Botones", notes: "Circuito interno de botones laterales.", baseCost: 12, basePrice: 40 },
        { suffix: "Botón Físico (Set Externo)", category: "other", partType: "Botón", notes: "Piezas metálicas externas (Power, Vol+, Vol-, Mute).", baseCost: 5, basePrice: 15 },
        { suffix: "Módulo Face ID / TrueDepth", category: "other", partType: "Face ID", notes: "NO REEMPLAZABLE. Solo referencia técnica. Vinculado a placa base.", baseCost: 0, basePrice: 0, stock: 0 },
        
        // --- Estructura ---
        { suffix: "Housing Completo (Chasis)", category: "case", partType: "Housing", notes: "Estructura trasera completa con cristal.", baseCost: 50, basePrice: 120 },
        { suffix: "Bandeja SIM", category: "other", partType: "Bandeja SIM", notes: "Porta chip exterior.", baseCost: 2, basePrice: 10 },
        { suffix: "Sello de Agua (Waterproof Seal)", category: "other", partType: "Sello", notes: "Adhesivo de pantalla para resistencia IP68.", baseCost: 2, basePrice: 10 },
        
        // --- Otros ---
        { suffix: "Taptic Engine (Vibrador)", category: "other", partType: "Vibrador", notes: "Motor háptico lineal.", baseCost: 15, basePrice: 40 },
        { suffix: "Sensor de Proximidad (Flex)", category: "other", partType: "Sensor", notes: "Si se daña puede perderse Face ID en algunos modelos.", baseCost: 15, basePrice: 45 },
    ];

    let createdCount = 0;
    const errors = [];

    // Procesamiento en lotes para no saturar
    const BATCH_SIZE = 20;
    let batch = [];

    for (const model of MODELS) {
        for (const part of PART_TEMPLATES) {
            
            const notes = typeof part.notes === 'function' ? part.notes(model) : part.notes;
            const fullName = `${part.partType} - ${model.name}`;
            
            // Generar SKU único
            const skuCategory = part.category.substring(0,2).toUpperCase();
            const skuModel = model.name.replace("iPhone ", "").replace(" ", "").toUpperCase();
            const skuType = part.partType.substring(0,3).toUpperCase();
            const sku = `AP-${skuModel}-${skuType}-${Math.floor(Math.random()*1000)}`;

            const productData = {
                name: fullName,
                description: `${part.suffix} para ${model.name}. \nNotas: ${notes}`,
                type: "product",
                subcategoria: "piezas_servicios", // Categoría interna para piezas
                category: part.category,
                part_type: part.partType, // Campo específico para el tipo de pieza
                price: part.basePrice,
                cost: part.baseCost,
                stock: part.stock !== undefined ? part.stock : 5, // Stock inicial por defecto
                min_stock: 2,
                active: true,
                compatibility_models: [model.name],
                compatible_families: [model.family],
                compatible_brands: ["Apple"],
                device_category: "Smartphone",
                sku: sku,
                taxable: true,
                tags: ["reparación", "apple", model.name, part.partType.toLowerCase()]
            };

            batch.push(productData);

            if (batch.length >= BATCH_SIZE) {
                try {
                    // Insertar lote
                    await Promise.all(batch.map(p => base44.entities.Product.create(p)));
                    createdCount += batch.length;
                } catch (e) {
                    console.error("Error inserting batch:", e);
                    errors.push(e.message);
                }
                batch = [];
            }
        }
    }

    // Insertar remanentes
    if (batch.length > 0) {
        try {
            await Promise.all(batch.map(p => base44.entities.Product.create(p)));
            createdCount += batch.length;
        } catch (e) {
            console.error("Error inserting final batch:", e);
            errors.push(e.message);
        }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: `Inventory population complete. Created ${createdCount} items.`,
        errors: errors.length > 0 ? errors : null
    }), { 
        headers: { "Content-Type": "application/json" } 
    });
}
