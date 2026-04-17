import React from 'react';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { useTranslation } from '@/components/utils/i18n';

export default function LanguageSelector() {
  const { language, changeLanguage } = useTranslation();

  return (
    <div className="apple-type flex items-center gap-2">
      <Globe className="w-4 h-4 apple-label-tertiary" />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={language === 'es' ? 'default' : 'outline'}
          onClick={() => changeLanguage('es')}
          className={language === 'es' ? 'apple-btn apple-btn-primary apple-press' : 'apple-btn apple-btn-secondary apple-press'}
        >
          ES
        </Button>
        <Button
          size="sm"
          variant={language === 'en' ? 'default' : 'outline'}
          onClick={() => changeLanguage('en')}
          className={language === 'en' ? 'apple-btn apple-btn-primary apple-press' : 'apple-btn apple-btn-secondary apple-press'}
        >
          EN
        </Button>
      </div>
    </div>
  );
}
