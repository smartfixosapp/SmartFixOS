import React, { useState, useEffect } from "react";
import CheckoutModalDesktop from "./CheckoutModalDesktop";
import CheckoutModalMobile from "./CheckoutModalMobile";
import { usePanelState } from "@/components/utils/panelContext";

/**
 * Wrapper que selecciona automáticamente entre Desktop y Mobile
 * Mantiene toda la lógica de cobro igual
 */
export default function CheckoutModal({
  open,
  onClose,
  total,
  effectiveTotal,
  subtotal,
  tax,
  taxEnabled,
  setTaxEnabled,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  splitCashAmount,
  setSplitCashAmount,
  splitAthAmount,
  setSplitAthAmount,
  depositAmount,
  setDepositAmount,
  athMovilPhone,
  setAthMovilPhone,
  athMovilName,
  setAthMovilName,
  cart,
  change,
  isPaymentValid,
  processing,
  onConfirmPayment,
  enabledPaymentMethods,
  paymentMode,
  totalPaid,
  workOrderId,
  discountAmount,
  quickDepositAmounts,
  quickCashAmounts
}) {
  const [isMobile, setIsMobile] = useState(false);
  const { registerPanel, unregisterPanel } = usePanelState();

  // ✅ Registrar panel cuando se abre
  useEffect(() => {
    if (open) {
      registerPanel('checkout-modal');
      return () => unregisterPanel('checkout-modal');
    }
  }, [open, registerPanel, unregisterPanel]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    const listener = window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Props compartidas para ambos modales
  const sharedProps = {
    open,
    onClose,
    total,
    effectiveTotal,
    subtotal,
    tax,
    taxEnabled,
    setTaxEnabled,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    splitCashAmount,
    setSplitCashAmount,
    splitAthAmount,
    setSplitAthAmount,
    depositAmount,
    setDepositAmount,
    athMovilPhone,
    setAthMovilPhone,
    athMovilName,
    setAthMovilName,
    cart,
    change,
    isPaymentValid,
    processing,
    onConfirmPayment,
    enabledPaymentMethods,
    paymentMode,
    totalPaid,
    workOrderId,
    discountAmount,
    quickDepositAmounts,
    quickCashAmounts
  };

  return (
    <>
      {isMobile ? <CheckoutModalMobile {...sharedProps} /> : <CheckoutModalDesktop {...sharedProps} />}
    </>
  );
}
