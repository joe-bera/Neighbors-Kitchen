import { useEffect } from 'react'

const SITE_NAME = 'Neighbors Kitchen'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Home-cooked meals from local chefs`
  }, [title])
}
