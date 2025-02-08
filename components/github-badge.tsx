import React from 'react'
import { StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'

import { BlurView } from 'expo-blur'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { ExternalLink } from './external-link'

interface GitHubBadgeProps {
    repoName: string
}

export function GitHubBadge({ repoName }: GitHubBadgeProps) {
    return (
        <ExternalLink
            href={`https://github.com/${repoName}`}
            style={styles.repoBadgeLink}
        >
            <BlurView
                intensity={80}
                tint="dark"
                style={styles.repoBadgeContainer}
            >
                <MaterialCommunityIcons
                    name="github"
                    size={16}
                    color="#FFFFFF"
                    style={styles.repoBadgeIcon}
                />
                <Text style={styles.repoBadgeText}>{repoName}</Text>
            </BlurView>
        </ExternalLink>
    )
}

const styles = StyleSheet.create({
    repoBadgeLink: {
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
    },
    repoBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    repoBadgeIcon: {
        marginRight: 6,
    },
    repoBadgeText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
})
