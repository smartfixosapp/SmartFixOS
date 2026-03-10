import React from "react";
import { Button } from "@/components/ui/button";
import { Bell, MessageCircle } from "lucide-react";

export default function SocialInbox({ session, onNewMessage }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-red-500" />
          <h3 className="text-white font-semibold">Social Inbox</h3>
        </div>
        {session?.userName &&
        <span className="text-xs text-gray-400">Conectado como {session.userName}</span>
        }
      </div>

      <p className="text-sm text-gray-400 mt-2">
        Próximamente: centraliza mensajes de WhatsApp, Instagram y Facebook aquí.
      </p>

      <div className="mt-3">
        <Button
          type="button"
          variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground h-8 border-white/20 hover:bg-white/10"

          onClick={() => onNewMessage?.("Nuevo mensaje de prueba", "Has recibido un mensaje de prueba.")}>

          <Bell className="w-4 h-4 mr-2" />
          Probar notificación
        </Button>
      </div>
    </div>);

}
