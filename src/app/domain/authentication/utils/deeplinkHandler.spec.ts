import { handleLogoutDeepLink } from '/app/domain/authentication/utils/deeplinkHandler'
import { closeInAppBrowser } from '/libs/intents/InAppBrowser'

jest.mock('/libs/intents/InAppBrowser')

describe('deeplinkHandler', () => {
  describe('handleLogoutDeepLink', () => {
    it('should handle AfterLogout deep links', () => {
      handleLogoutDeepLink('cozy://afterlogout')

      expect(closeInAppBrowser).toHaveBeenCalled()
    })

    it('should handle AfterLogout universal links', () => {
      handleLogoutDeepLink('https://links.mycozy.cloud/flagship/afterlogout')

      expect(closeInAppBrowser).toHaveBeenCalled()
    })
  })
})
