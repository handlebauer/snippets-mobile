import React from 'react'
import { Platform } from 'react-native'
import { Link } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'

export function ExternalLink(
    props: Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string },
) {
    return (
        <Link
            target="_blank"
            {...props}
            // @ts-expect-error
            href={props.href}
            onPress={e => {
                if (Platform.OS !== 'web') {
                    // Prevent the default behavior of linking to the default browser on native.
                    e.preventDefault()
                    // Open the link in an in-app browser.
                    WebBrowser.openBrowserAsync(props.href as string)
                }
            }}
        />
    )
}
