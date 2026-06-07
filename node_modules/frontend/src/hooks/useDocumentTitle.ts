import { useEffect } from 'react';

const DEFAULT_APP_NAME = 'lux.om';

type UseDocumentTitleOptions = {
  appName?: string;
  restoreOnUnmount?: boolean;
};

export function useDocumentTitle(title: string, options: UseDocumentTitleOptions = {}) {
  const { appName = DEFAULT_APP_NAME, restoreOnUnmount = false } = options;

  useEffect(() => {
    const previousTitle = document.title;
    const cleanTitle = title.trim();

    document.title = cleanTitle ? `${cleanTitle} | ${appName}` : appName;

    return () => {
      if (restoreOnUnmount) {
        document.title = previousTitle;
      }
    };
  }, [title, appName, restoreOnUnmount]);
}