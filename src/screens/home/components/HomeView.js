import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'

import {
  deconstructCozyWebLinkWithSlug,
  generateWebLink,
  useClient
} from 'cozy-client'
import Minilog from 'cozy-minilog'

import rnperformance from '/app/domain/performances/measure'
import { CozyProxyWebView } from '/components/webviews/CozyProxyWebView'
import { navigateToApp } from '/libs/functions/openApp'
import { useIsHomeUnavailable } from '/libs/functions/homeAvailability'
import {
  getOrFetchDefaultRedirectionUrl,
  getParamsWithDefaultRedirectionUrl
} from '/libs/defaultRedirection/defaultRedirection'
import { formatRedirectLink } from '/libs/functions/formatRedirectLink'
import { getErrorMessage } from '/libs/functions/getErrorMessage'
import {
  consumeRouteParameter,
  useInitialParam
} from '/libs/functions/routeHelpers'
import { useSession } from '/hooks/useSession'
import { useHomeStateContext } from '/screens/home/HomeStateProvider'
import { devlog } from '/core/tools/env'
import { ScreenIndexes, useFlagshipUI } from '/app/view/FlagshipUI'
import { OsReceiveScreen } from '/app/view/OsReceive/OsReceiveScreen'
import { useFilesToUpload } from '/app/view/OsReceive/state/OsReceiveState'

const log = Minilog('HomeView')

/**
 * @typedef Props
 * @prop {unknown} navigation
 * @prop {unknown} route
 */

/**
 * @param {Props} props
 */
const HomeView = ({ route, navigation }) => {
  const client = useClient()
  const [uri, setUri] = useState('')
  const { shouldWaitCozyApp, setShouldWaitCozyApp } = useHomeStateContext()
  const [trackedWebviewInnerUri, setTrackedWebviewInnerUri] = useState('')
  const session = useSession()
  const didBlurOnce = useRef(false)
  const mainAppFallbackURLInitialParam = useInitialParam(
    'mainAppFallbackURL',
    route,
    navigation
  )
  const cozyAppFallbackURLInitialParam = useInitialParam(
    'cozyAppFallbackURL',
    route,
    navigation
  )
  const filesToUpload = useFilesToUpload()
  const hasFilesToUpload = filesToUpload.length > 0
  const isHomeUnavailable = useIsHomeUnavailable()
  const [markNameHome] = useState(() => rnperformance.mark('HomeView'))

  const { componentId } = useFlagshipUI('HomeView', ScreenIndexes.HOME_VIEW)

  useEffect(() => {
    if (uri && shouldWaitCozyApp !== undefined && !shouldWaitCozyApp) {
      rnperformance.measure({
        markName: markNameHome,
        measureName: 'HomeStartRenderChild'
      })
    }
  }, [markNameHome, uri, shouldWaitCozyApp])

  useEffect(() => {
    rnperformance.measure({
      markName: markNameHome,
      measureName: 'HomeStart'
    })
  }, [markNameHome])

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      didBlurOnce.current = true
      if (trackedWebviewInnerUri && client.isLogged) {
        setUri(trackedWebviewInnerUri)
      }
    })

    return unsubscribe
  }, [navigation, trackedWebviewInnerUri, client])

  // Some instances don't have the home app installed, so it answers a 404 and
  // this view has nothing to render. Every route leading back here would show
  // that empty view, so redirect to the instance default redirection instead,
  // or to settings when that redirection is home or can't be resolved. Files
  // received from the OS still need the upload screen rendered by this view.
  useFocusEffect(
    useCallback(() => {
      if (!isHomeUnavailable || hasFilesToUpload) return undefined

      let isStillFocused = true

      const redirectToDefaultRedirection = async () => {
        try {
          const defaultRedirectionUrl = await getOrFetchDefaultRedirectionUrl(
            client
          )

          if (!isStillFocused) return

          const { cozyAppFallbackURL } = getParamsWithDefaultRedirectionUrl(
            defaultRedirectionUrl,
            client
          )
          const href =
            cozyAppFallbackURL ?? formatRedirectLink('settings/', client)

          if (!href) return

          const subdomainType = client.capabilities.flat_subdomains
            ? 'flat'
            : 'nested'
          const { slug } = deconstructCozyWebLinkWithSlug(href, subdomainType)

          navigateToApp({ navigation, href, slug })
        } catch (error) {
          log.error(
            `Could not redirect from unavailable home: ${getErrorMessage(
              error
            )}`
          )
        }
      }

      void redirectToDefaultRedirection()

      return () => {
        isStillFocused = false
      }
    }, [client, hasFilesToUpload, isHomeUnavailable, navigation])
  )

  useFocusEffect(
    useCallback(() => {
      if (uri) {
        const konnectorParam = consumeRouteParameter(
          'konnector',
          route,
          navigation
        )

        if (konnectorParam) {
          const url = new URL(uri)
          url.hash = `/connected/${konnectorParam}`

          const accountParam = consumeRouteParameter(
            'account',
            route,
            navigation
          )
          if (accountParam) {
            url.hash += `/accounts/${accountParam}`
          }

          const targetUri = url.toString()
          setUri(targetUri)
        }
      }
    }, [navigation, route, uri])
  )

  useEffect(() => {
    const href = consumeRouteParameter('href', route, navigation)
    const mainAppFallbackURL = mainAppFallbackURLInitialParam.consume()
    const deepLink = href || mainAppFallbackURL

    if (deepLink) {
      return setUri(deepLink)
    }

    const { shouldCreateSession, handleCreateSession, consumeSessionToken } =
      session

    const getHomeUri = async () => {
      const markName = rnperformance.mark('getHomeUri')
      const webLink = generateWebLink({
        cozyUrl: client.getStackClient().uri,
        hash: 'connected',
        pathname: '/',
        slug: 'home',
        subDomainType: session.subDomainType
      })
      rnperformance.measure({
        markName: markName,
        measureName: `${markName} generateWebLink`
      })

      if (await shouldCreateSession(webLink)) {
        const sessionLink = await handleCreateSession(webLink)
        await consumeSessionToken()

        rnperformance.measure({
          markName: markName,
          measureName: `${markName} setUri sessionLink`
        })
        setUri(sessionLink)
      } else {
        rnperformance.measure({
          markName: markName,
          measureName: `${markName} setUri webLink`
        })
        setUri(webLink)
      }
    }

    if (!uri && session.subDomainType) {
      getHomeUri()
    }
  }, [uri, client, route, mainAppFallbackURLInitialParam, navigation, session])

  useEffect(() => {
    devlog('HomeView: determine CozyApp Fallback')

    async function handleCozyAppFallback() {
      if (uri) {
        const cozyAppFallbackURL = cozyAppFallbackURLInitialParam.consume()
        const hasFilesToUpload = filesToUpload.length > 0

        if (cozyAppFallbackURL && !hasFilesToUpload) {
          setShouldWaitCozyApp(true)
          const subdomainType = client.capabilities?.flat_subdomains
            ? 'flat'
            : 'nested'
          const { slug } = deconstructCozyWebLinkWithSlug(
            cozyAppFallbackURL,
            subdomainType
          )
          navigateToApp({
            navigation,
            href: cozyAppFallbackURL,
            slug
          })
        } else {
          if (shouldWaitCozyApp === undefined) {
            setShouldWaitCozyApp(false)
          }
        }
      }
    }

    void handleCozyAppFallback()
  }, [
    client,
    cozyAppFallbackURLInitialParam,
    navigation,
    shouldWaitCozyApp,
    setShouldWaitCozyApp,
    uri,
    filesToUpload.length
  ])

  const handleTrackWebviewInnerUri = webviewInneruri => {
    if (webviewInneruri !== trackedWebviewInnerUri) {
      setTrackedWebviewInnerUri(webviewInneruri)
    }
  }

  return uri && shouldWaitCozyApp !== undefined && !shouldWaitCozyApp ? (
    <>
      <CozyProxyWebView
        slug="home"
        href={uri}
        trackWebviewInnerUri={handleTrackWebviewInnerUri}
        navigation={navigation}
        route={route}
        logId="HomeView"
        componentId={componentId}
      />

      <OsReceiveScreen />
    </>
  ) : null
}

export default HomeView
