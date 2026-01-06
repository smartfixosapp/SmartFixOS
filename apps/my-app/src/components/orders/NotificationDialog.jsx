import React, { useState } from "react";
import { SendEmail } from "@/api/integrations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NotificationDialog({ open, onClose, order }) {
  const [methods, setMethods] = useState({
    email: false,
    sms: false,
    whatsapp: false
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    setSending(true);
    
    const message = `Hello ${order.customer_name},\n\nYour repair order #${order.order_number} has been accepted and is now being worked on.\n\nDevice: ${order.device_type}\nEstimated completion: ${order.estimated_completion || 'To be determined'}\n\nWe'll notify you once your device is ready for pickup.\n\nThank you for choosing our service!`;

    try {
      if (methods.email && order.customer_email) {
        await SendEmail({
          to: order.customer_email,
          subject: `Order ${order.order_number} - Accepted`,
          body: message
        });
      }

      if (methods.sms && order.customer_phone) {
        window.open(`sms:${order.customer_phone}?body=${encodeURIComponent(message)}`, '_blank');
      }

      if (methods.whatsapp && order.customer_phone) {
        const phoneNumber = order.customer_phone.replace(/\D/g, '');
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setMethods({ email: false, sms: false, whatsapp: false });
      }, 2000);
    } catch (error) {
      console.error("Error sending notifications:", error);
    }

    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Order Notification</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Notify {order?.customer_name} that order #{order?.order_number} has been accepted and is being worked on.
          </p>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="email" 
                checked={methods.email}
                onCheckedChange={(checked) => setMethods({ ...methods, email: checked })}
                disabled={!order?.customer_email}
              />
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
                {!order?.customer_email && <span className="text-xs text-slate-400">(No email on file)</span>}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="sms" 
                checked={methods.sms}
                onCheckedChange={(checked) => setMethods({ ...methods, sms: checked })}
              />
              <Label htmlFor="sms" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                SMS
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="whatsapp" 
                checked={methods.whatsapp}
                onCheckedChange={(checked) => setMethods({ ...methods, whatsapp: checked })}
              />
              <Label htmlFor="whatsapp" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 fill-green-500 text-green-500" />
                WhatsApp
              </Label>
            </div>
          </div>

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                Notifications sent successfully!
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
              disabled={sending || (!methods.email && !methods.sms && !methods.whatsapp)}
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
