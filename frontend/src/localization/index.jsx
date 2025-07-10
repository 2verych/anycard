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
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved) setLang(saved);
    fetch(`${API_URL}/localization`)
      .then(res => res.json())
      .then(obj => {
        setData(obj);
        if (saved && obj[saved]) {
          setLang(saved);
        } else if (obj['en']) {
          setLang('en');
        } else {
          const first = Object.keys(obj)[0];
          if (first) setLang(first);
        }
      });
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (path) => {
    const parts = path.split('.');
    let val = data[lang];
    for (const p of parts) {
      if (!val) break;
      val = val[p];
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

export const useLocalization = () => useContext(LocalizationContext);
