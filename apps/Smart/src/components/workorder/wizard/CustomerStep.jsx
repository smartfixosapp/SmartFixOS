import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "../../../../../../lib/supabase-client.js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, User, X, Plus, Building2 } from "lucide-react";

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
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      let dbQuery = supabase.from("customer").select("id, name, phone, email, additional_phones, is_b2b, company_name, company_tax_id, billing_contact_person");
      if (tenantId) {
        dbQuery = dbQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
      }
      const { data: allCustomers } = await dbQuery;
      const lq = q.toLowerCase();
      const filtered = (allCustomers || []).filter((c) =>
        (c.name || "").toLowerCase().includes(lq) ||
        (c.phone || "").toLowerCase().includes(lq) ||
        (c.email || "").toLowerCase().includes(lq)
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
    <div className="space-y-4 bg-apple-surface">
      {/* AI FIX: b2b in WorkOrderWizard - B2B Toggle at top */}
      <div className="apple-card p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <label className="apple-text-headline text-apple-label-primary flex items-center gap-2">
              <Building2 className="w-4 h-4 text-apple-purple" />
              Cliente Empresarial (B2B)
            </label>
            <p className="apple-text-footnote text-apple-label-secondary mt-1">
              Permite crear múltiples trabajos de una vez y facturación agrupada
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleB2BToggle(!isB2B)}
            className={`apple-press relative w-[51px] h-[31px] rounded-full transition-colors duration-200 ${
              isB2B ? "bg-apple-green" : "bg-gray-sys5 dark:bg-gray-sys4"
            }`}
          >
            <span
              className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-apple-sm transition-transform duration-200 ${
                isB2B ? "translate-x-[20px]" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* AI FIX: b2b in WorkOrderWizard - B2B Fields shown first when enabled */}
      {isB2B && (
        <div className="apple-card p-4 mb-4 space-y-4">
          <h3 className="apple-text-headline text-apple-label-primary flex items-center gap-2">
            <span className="w-2 h-2 bg-apple-purple rounded-full" />
            Información Empresarial
          </h3>

          <div className="space-y-2">
            <Label htmlFor="company-name" className="apple-text-subheadline text-apple-label-secondary">Nombre de la Empresa *</Label>
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
              className="apple-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-tax-id" className="apple-text-subheadline text-apple-label-secondary">RUT / Tax ID / RNC</Label>
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
                className="apple-input tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-contact" className="apple-text-subheadline text-apple-label-secondary">Persona de Contacto</Label>
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
                className="apple-input"
              />
            </div>
          </div>

          <div className="bg-apple-purple/12 rounded-apple-md p-3">
            <p className="apple-text-footnote text-apple-purple">
              Podrás crear múltiples trabajos para esta empresa en un solo proceso y agrupar facturas
            </p>
          </div>
        </div>
      )}

      {/* Buscar cliente */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-label-tertiary w-5 h-5 pointer-events-none" />
        <Input
          id="customer-search"
          name="customerSearch"
          autoComplete="off"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={stopEnterPropagation}
          onFocus={ensureVisible}
          placeholder="Buscar por teléfono, nombre o email..."
          className="apple-input pl-10"
        />

        {showResults && searchResults.length > 0 && (
          <div className="apple-list absolute top-full left-0 right-0 mt-2 shadow-apple-lg z-50 max-h-64 overflow-y-auto">
            {searchResults.map((customer, idx) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelectCustomer(customer)}
                className="apple-list-row apple-press w-full text-left flex items-center gap-3"
                style={idx !== searchResults.length - 1 ? { borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" } : undefined}
              >
                <div className="apple-list-row-icon bg-apple-blue/12 grid place-items-center flex-shrink-0">
                  <User className="w-5 h-5 text-apple-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="apple-list-row-title apple-text-body text-apple-label-primary truncate">{customer.name}</p>
                  {customer.phone && (
                    <p className="apple-text-footnote text-apple-label-secondary tabular-nums">{formatPhonePretty(customer.phone)}</p>
                  )}
                  {customer.email && (
                    <p className="apple-text-footnote text-apple-label-tertiary truncate">{customer.email}</p>
                  )}
                  {/* AI FIX: b2b in WorkOrderWizard - Show B2B badge in search results */}
                  {customer.is_b2b && customer.company_name && (
                    <p className="apple-text-footnote text-apple-purple truncate flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {customer.company_name}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="bg-apple-blue/12 text-apple-blue apple-text-caption2 px-2 py-0.5 rounded-apple-xs tabular-nums">
                    {customer.total_orders || 0} órdenes
                  </span>
                  {customer.is_b2b && (
                    <span className="bg-apple-purple/12 text-apple-purple apple-text-caption2 px-2 py-0.5 rounded-apple-xs">
                      B2B
                    </span>
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
            <Label htmlFor="first-name" className="apple-text-subheadline text-apple-label-secondary">Nombre *</Label>
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
              className="apple-input"
            />
          </div>

          {/* APELLIDO */}
          <div className="space-y-2">
            <Label htmlFor="last-name" className="apple-text-subheadline text-apple-label-secondary">Apellido *</Label>
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
              className="apple-input"
            />
          </div>
        </div>

        {/* TELÉFONO */}
        <div className="space-y-2">
          <Label htmlFor="main-phone" className="apple-text-subheadline text-apple-label-secondary">Teléfono Principal *</Label>
          <Input
            id="main-phone"
            name="phone"
            type="text"
            inputMode="text"
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
            className="apple-input tabular-nums"
            maxLength={14}
          />
        </div>

        {/* TELÉFONOS ADICIONALES */}
        {(formData.customer.additional_phones || []).length > 0 && (
          <div className="space-y-2">
            <Label className="apple-text-subheadline text-apple-label-secondary">Teléfonos Adicionales</Label>
            {formData.customer.additional_phones.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="text"
                  inputMode="text"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => handleUpdateAdditionalPhone(index, e.target.value)}
                  onKeyDown={stopEnterPropagation}
                  onFocus={ensureVisible}
                  placeholder="7875550456"
                  className="apple-input tabular-nums flex-1"
                  maxLength={10}
                />
                <Button
                  type="button"
                  onClick={() => handleRemovePhone(index)}
                  className="apple-btn apple-btn-destructive apple-press"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          onClick={handleAddPhone}
          className="apple-btn apple-btn-tinted apple-press w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Añadir Teléfono Adicional
        </Button>

        {/* EMAIL */}
        <div className="space-y-2">
          <Label htmlFor="email" className="apple-text-subheadline text-apple-label-secondary">Email (opcional)</Label>
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
            className="apple-input"
          />
        </div>

        <div className="bg-apple-yellow/15 rounded-apple-md p-3 mt-4">
          <p className="apple-text-footnote text-apple-orange">
            * Campos obligatorios
            {isB2B && (
              <span className="ml-2 text-apple-purple font-semibold inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Modo Empresarial Activo
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
