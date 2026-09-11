import { useLocaleStore } from "../store/localeStore";
import { translations, type TranslationKey } from "./translations";

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: TranslationKey): string => translations[locale][key] ?? translations.az[key] ?? key;
}
