import strings from '/constants/strings.json'
import { closeInAppBrowser } from '/libs/intents/InAppBrowser'

export const handleLogoutDeepLink = (url: string): boolean => {
  if (isAfterLogoutDeepLink(url)) {
    void closeInAppBrowser()

    return true
  }

  return false
}

const isAfterLogoutDeepLink = (url: string): boolean => {
  const deepLinks = [
    `${strings.COZY_SCHEME}afterlogout`,
    `${strings.UNIVERSAL_LINK_BASE}/afterlogout`
  ]

  return deepLinks.includes(url.toLowerCase())
}
