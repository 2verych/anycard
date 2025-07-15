import { createContext, useContext, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const LocalizationContext = createContext({
  t: (k) => k,
  lang: 'en',
  setLang: () => {},
  langs: {}
});

export function LocalizationProvider({ children }) {
  const [data, setData] = useState({});
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    fetch(`${API_URL}/localization`)
      .then(res => res.json())
      .then(obj => {
        setData(obj);
        const candidate = saved && obj[saved] ? saved : obj['en'] ? 'en' : Object.keys(obj)[0];
        if (candidate) setLang(candidate);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (path, vars) => {
    const parts = path.split('.');
    let val = data[lang];
    for (const p of parts) {
      if (!val) break;
      val = val[p];
    }
    if (val && vars) {
      Object.entries(vars).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, v);
      });
    }
    return val ?? path;
  };

  const langs = Object.fromEntries(
    Object.entries(data).map(([code, d]) => [code, d.lang])
  );

  return (
    <LocalizationContext.Provider value={{ t, lang, setLang, langs }}>
      {children}
    </LocalizationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLocalization = () => useContext(LocalizationContext);
