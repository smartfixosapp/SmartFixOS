import React from 'react';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { useTranslation } from '@/components/utils/i18n';

export default function LanguageSelector() {
  const { language, changeLanguage } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-gray-400" />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={language === 'es' ? 'default' : 'outline'}
          onClick={() => changeLanguage('es')}
          className={language === 'es' ? 'bg-gradient-to-r from-cyan-600 to-emerald-600' : ''}
        >
          🇪🇸 ES
        </Button>
        <Button
          size="sm"
          variant={language === 'en' ? 'default' : 'outline'}
          onClick={() => changeLanguage('en')}
          className={language === 'en' ? 'bg-gradient-to-r from-cyan-600 to-emerald-600' : ''}
        >
          🇺🇸 EN
        </Button>
      </div>
    </div>
  );
}
