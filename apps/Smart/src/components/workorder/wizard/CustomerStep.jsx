import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, User, X, Plus } from "lucide-react";

export default function CustomerStep({ formData, updateFormData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);

  const [phoneRaw, setPhoneRaw] = useState(formData.customer?.phone || "");
  
  // AI FIX: b2b customer support - B2B toggle state
  const [isB2B, setIsB2B] = useState(formData.customer?.is_b2b || false);

  // ---- refs para controlar foco solo una vez
  const didAutofocus = useRef(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    setPhoneRaw(formData.customer?.phone || "");
  }, [formData.customer?.phone]);

  // Autofocus controlado SOLO una vez y SOLO si ambos campos están vacíos
  useEffect(() => {
    if (didAutofocus.current) return;
    const isEmpty =
      !(formData.customer?.name || "").trim() &&
      !(formData.customer?.last_name || "").trim();
    if (isEmpty && nameInputRef.current) {
      didAutofocus.current = true;
      // pequeño delay para evitar carreras con el modal
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [formData.customer?.name, formData.customer?.last_name]);

  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      performSearch(searchQuery.trim());
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  const performSearch = async (q) => {
    setSearching(true);
    try {
      const customers = await base44.entities.Customer.list();
      const query = q.toLowerCase();
      const filtered = (customers || []).filter((c) =>
        (c.name || "").toLowerCase().includes(query) ||
        (c.phone || "").toLowerCase().includes(query) ||
        (c.email || "").toLowerCase().includes(query)
      );
      setSearchResults(filtered.slice(0, 8));
      setShowResults(true);
    } catch (e) {
      console.error("Error searching customers:", e);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    const [firstName, ...lastNameParts] = (customer.name || "").split(" ");
    // AI FIX: b2b customer support - Load B2B data if exists
    updateFormData("customer", {
      name: firstName || "",
      last_name: lastNameParts.join(" "),
      phone: customer.phone || "",
      email: customer.email || "",
      additional_phones: customer.additional_phones || [],
      is_b2b: customer.is_b2b || false,
      company_name: customer.company_name || "",
      company_tax_id: customer.company_tax_id || "",
      billing_contact_person: customer.billing_contact_person || "",
    });
    updateFormData("existing_customer_id", customer.id);
    setPhoneRaw(customer.phone || "");
    setIsB2B(customer.is_b2b || false);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleAddPhone = () => {
    const phones = formData.customer.additional_phones || [];
    updateFormData("customer", {
      ...formData.customer,
      additional_phones: [...phones, ""],
    });
  };

  const handleUpdateAdditionalPhone = (index, value) => {
    const onlyDigits = value.replace(/\D/g, "").slice(0, 10);
    const phones = [...(formData.customer.additional_phones || [])];
    phones[index] = onlyDigits;
    updateFormData("customer", { ...formData.customer, additional_phones: phones });
  };

  const handleRemovePhone = (index) => {
    const phones = (formData.customer.additional_phones || []).filter((_, i) => i !== index);
    updateFormData("customer", { ...formData.customer, additional_phones: phones });
  };

  const formatPhonePretty = (raw) => {
    const digits = (raw || "").replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const stopEnterPropagation = (e) => {
    if (e.key === "Enter") e.stopPropagation();
  };

  const ensureVisible = (e) => {
    try {
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
  };

  // AI FIX: b2b customer support - Handle B2B toggle
  const handleB2BToggle = (value) => {
    setIsB2B(value);
    updateFormData("customer", {
      ...formData.customer,
      is_b2b: value,
      // Clear B2B fields if switching to regular customer
      ...(!value && {
        company_name: "",
        company_tax_id: "",
        billing_contact_person: ""
      })
    });
  };

  return (
    <div className="space-y-4">
      {/* AI FIX: b2b in WorkOrderWizard - B2B Toggle at top */}
      <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-2 border-purple-500/40 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <label className="text-white font-bold text-base flex items-center gap-2">
              🏢 Cliente Empresarial (B2B)
            </label>
            <p className="text-xs text-gray-400 mt-1">
              Permite crear múltiples trabajos de una vez y facturación agrupada
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleB2BToggle(!isB2B)}
            className={`relative w-16 h-8 rounded-full transition-all ${
              isB2B ? "bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/50" : "bg-gray-600"
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform shadow-md ${
                isB2B ? "translate-x-8" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* AI FIX: b2b in WorkOrderWizard - B2B Fields shown first when enabled */}
      {isB2B && (
        <div className="space-y-4 bg-purple-600/5 border-2 border-purple-500/30 rounded-xl p-4 mb-4">
          <h3 className="text-purple-300 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
            Información Empresarial
          </h3>
          
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-gray-300 font-semibold">Nombre de la Empresa *</Label>
            <Input
              id="company-name"
              name="companyName"
              autoComplete="organization"
              value={formData.customer.company_name || ""}
              onChange={(e) =>
                updateFormData("customer", { ...formData.customer, company_name: e.target.value })
              }
              onKeyDown={stopEnterPropagation}
              onFocus={ensureVisible}
              placeholder="Tech Solutions Corp"
              className="bg-black border-purple-700/50 text-white h-12 text-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-tax-id" className="text-gray-300">RUT / Tax ID / RNC</Label>
              <Input
                id="company-tax-id"
                name="companyTaxId"
                value={formData.customer.company_tax_id || ""}
                onChange={(e) =>
                  updateFormData("customer", { ...formData.customer, company_tax_id: e.target.value })
                }
                onKeyDown={stopEnterPropagation}
                onFocus={ensureVisible}
                placeholder="12-3456789-0"
                className="bg-black border-purple-700/50 text-white h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-contact" className="text-gray-300">Persona de Contacto</Label>
              <Input
                id="billing-contact"
                name="billingContact"
                value={formData.customer.billing_contact_person || ""}
                onChange={(e) =>
                  updateFormData("customer", { ...formData.customer, billing_contact_person: e.target.value })
                }
                onKeyDown={stopEnterPropagation}
                onFocus={ensureVisible}
                placeholder="María López (CFO)"
                className="bg-black border-purple-700/50 text-white h-12 text-base"
              />
            </div>
          </div>

          <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-3">
            <p className="text-purple-300 text-xs">
              💡 Podrás crear múltiples trabajos para esta empresa en un solo proceso y agrupar facturas
            </p>
          </div>
        </div>
      )}

      {/* Buscar cliente */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
        <Input
          id="customer-search"
          name="customerSearch"
          autoComplete="off"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={stopEnterPropagation}
          onFocus={ensureVisible}
          placeholder="Buscar por teléfono, nombre o email..."
          className="pl-10 bg-black border-gray-700 text-white h-12 text-base"
        />

        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#2B2B2B] border border-red-900/30 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar">
            {searchResults.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelectCustomer(customer)}
                className="w-full text-left p-3 hover:bg-gray-800 cursor-pointer border-b border-gray-800 last:border-b-0 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full grid place-items-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{customer.name}</p>
                  {customer.phone && <p className="text-xs text-gray-400">{formatPhonePretty(customer.phone)}</p>}
                  {customer.email && (
                    <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                  )}
                  {/* AI FIX: b2b in WorkOrderWizard - Show B2B badge in search results */}
                  {customer.is_b2b && customer.company_name && (
                    <p className="text-xs text-purple-400 truncate">🏢 {customer.company_name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                    {customer.total_orders || 0} órdenes
                  </Badge>
                  {customer.is_b2b && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                      B2B
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Formulario */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* NOMBRE */}
          <div className="space-y-2">
            <Label htmlFor="first-name" className="text-gray-300">Nombre *</Label>
            <Input
              id="first-name"
              name="firstName"
              autoComplete="given-name"
              ref={nameInputRef}
              value={formData.customer.name}
              onChange={(e) =>
                updateFormData("customer", { ...formData.customer, name: e.target.value })
              }
              onKeyDown={stopEnterPropagation}
              onFocus={ensureVisible}
              placeholder="Juan"
              className="bg-black border-gray-700 text-white h-12 text-base"
            />
          </div>

          {/* APELLIDO */}
          <div className="space-y-2">
            <Label htmlFor="last-name" className="text-gray-300">Apellido *</Label>
            <Input
              id="last-name"
              name="lastName"
              autoComplete="family-name"
              value={formData.customer.last_name}
              onChange={(e) =>
                updateFormData("customer", { ...formData.customer, last_name: e.target.value })
              }
              onKeyDown={stopEnterPropagation}
              onFocus={ensureVisible}
              placeholder="Pérez"
              className="bg-black border-gray-700 text-white h-12 text-base"
            />
          </div>
        </div>

        {/* TELÉFONO */}
        <div className="space-y-2">
          <Label htmlFor="main-phone" className="text-gray-300">Teléfono Principal *</Label>
          <Input
            id="main-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phoneRaw}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              setPhoneRaw(digits);
              updateFormData("customer", { ...formData.customer, phone: digits });
            }}
            onBlur={() => {
              const pretty = formatPhonePretty(phoneRaw);
              setPhoneRaw(pretty);
              updateFormData("customer", { ...formData.customer, phone: pretty });
            }}
            onKeyDown={stopEnterPropagation}
            onFocus={(e) => {
              const digits = (phoneRaw || "").replace(/\D/g, "");
              setPhoneRaw(digits);
              ensureVisible(e);
            }}
            placeholder="787-555-0123"
            className="bg-black border-gray-700 text-white h-12 text-base tracking-wide"
            maxLength={14}
          />
        </div>

        {/* TELÉFONOS ADICIONALES */}
        {(formData.customer.additional_phones || []).length > 0 && (
          <div className="space-y-2">
            <Label className="text-gray-300">Teléfonos Adicionales</Label>
            {formData.customer.additional_phones.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => handleUpdateAdditionalPhone(index, e.target.value)}
                  onKeyDown={stopEnterPropagation}
                  onFocus={ensureVisible}
                  placeholder="7875550456"
                  className="bg-black border-gray-700 text-white h-12 text-base flex-1"
                  maxLength={10}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRemovePhone(index)}
                  className="border-gray-700 text-gray-300 hover:border-red-500 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleAddPhone}
          className="bg-background px-4 h-11 w-full border-gray-700 hover:border-[#FF0000] hover:text-[#FF0000]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Añadir Teléfono Adicional
        </Button>

        {/* EMAIL */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-300">Email (opcional)</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={formData.customer.email}
            onChange={(e) =>
              updateFormData("customer", { ...formData.customer, email: e.target.value })
            }
            onKeyDown={stopEnterPropagation}
            onFocus={ensureVisible}
            placeholder="cliente@example.com"
            className="bg-black border-gray-700 text-white h-12 text-base"
          />
        </div>

        <div className="bg-amber-600/10 border border-amber-500/30 rounded-lg p-3 mt-4">
          <p className="text-xs text-amber-300 theme-light:text-amber-700">
            * Campos obligatorios
            {isB2B && <span className="ml-2 text-purple-400 font-bold">🏢 Modo Empresarial Activo</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
