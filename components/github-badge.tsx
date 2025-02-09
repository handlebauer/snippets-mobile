import React, { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Dialog, Portal, Text } from 'react-native-paper'

import { BlurView } from 'expo-blur'
import * as WebBrowser from 'expo-web-browser'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface GitHubBadgeProps {
    repoName: string
}

interface Commit {
    message: string
    sha: string
    date: string
}

interface RepoInfo {
    description: string | null
    stargazers_count: number
    forks_count: number
    default_branch: string
    latest_commit?: Commit
}

function formatNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
}

function formatTimeAgo(date: string): string {
    const now = new Date()
    const past = new Date(date)
    const diffMs = now.getTime() - past.getTime()
    const diffMins = Math.floor(diffMs / (60 * 1000))
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

    if (diffMins < 60) {
        return `${diffMins}m ago`
    } else if (diffHours < 24) {
        return `${diffHours}h ago`
    } else if (diffDays < 30) {
        return `${diffDays}d ago`
    } else {
        return past.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }
}

export function GitHubBadge({ repoName }: GitHubBadgeProps) {
    const [visible, setVisible] = useState(false)
    const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [commits, setCommits] = useState<Commit[]>([])
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [page, setPage] = useState(1)

    const fetchRepoInfo = async () => {
        try {
            setLoading(true)
            setError(null)
            setCommits([])
            setPage(1)
            setHasMore(true)

            // Fetch basic repo info
            const repoResponse = await fetch(
                `https://api.github.com/repos/${repoName}`,
            )
            if (!repoResponse.ok) {
                throw new Error('Failed to fetch repository info')
            }
            const repoData = await repoResponse.json()

            // Fetch latest commit
            const commitsResponse = await fetch(
                `https://api.github.com/repos/${repoName}/commits/${repoData.default_branch}`,
            )
            if (!commitsResponse.ok) {
                throw new Error('Failed to fetch commit info')
            }
            const commitData = await commitsResponse.json()

            setRepoInfo({
                description: repoData.description,
                stargazers_count: repoData.stargazers_count,
                forks_count: repoData.forks_count,
                default_branch: repoData.default_branch,
                latest_commit: {
                    message: commitData.commit.message,
                    sha: commitData.sha.substring(0, 7),
                    date: commitData.commit.author.date,
                },
            })

            // Initialize with first commit
            setCommits([
                {
                    message: commitData.commit.message,
                    sha: commitData.sha.substring(0, 7),
                    date: commitData.commit.author.date,
                },
            ])

            // Fetch next 4 commits to show 3 more and determine if there are even more
            const commitsResponse2 = await fetch(
                `https://api.github.com/repos/${repoName}/commits?per_page=4&page=2&sha=${repoData.default_branch}`,
            )
            if (commitsResponse2.ok) {
                const data = await commitsResponse2.json()
                const moreCommits = data.slice(0, 3).map((commit: any) => ({
                    message: commit.commit.message,
                    sha: commit.sha.substring(0, 7),
                    date: commit.commit.author.date,
                }))
                setCommits(prev => [...prev, ...moreCommits])
                setHasMore(data.length > 3) // If we got a fourth commit, there are more
                setPage(3)
            }
        } catch (err) {
            console.error('Failed to fetch repo info:', err)
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to fetch repository info',
            )
        } finally {
            setLoading(false)
        }
    }

    const fetchMoreCommits = async () => {
        if (loadingMore || !repoInfo) return

        try {
            setLoadingMore(true)
            const response = await fetch(
                `https://api.github.com/repos/${repoName}/commits?per_page=4&page=${page}&sha=${repoInfo.default_branch}`,
            )
            if (!response.ok) throw new Error('Failed to fetch commits')

            const data = await response.json()
            const newCommits = data.slice(0, 3).map((commit: any) => ({
                message: commit.commit.message,
                sha: commit.sha.substring(0, 7),
                date: commit.commit.author.date,
            }))

            setCommits(prev => [...prev, ...newCommits])
            setHasMore(data.length > 3)
            setPage(prev => prev + 1)
        } catch (err) {
            console.error('Failed to fetch more commits:', err)
        } finally {
            setLoadingMore(false)
        }
    }

    const handlePress = () => {
        const url = `https://github.com/${repoName}`
        if (Platform.OS !== 'web') {
            WebBrowser.openBrowserAsync(url)
        } else {
            window.open(url, '_blank')
        }
    }

    const handleLongPress = () => {
        setVisible(true)
        fetchRepoInfo()
    }

    return (
        <>
            <Pressable
                onPress={handlePress}
                onLongPress={handleLongPress}
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
            </Pressable>

            <Portal>
                <Dialog
                    visible={visible}
                    onDismiss={() => setVisible(false)}
                    style={styles.dialog}
                >
                    <BlurView
                        intensity={100}
                        tint="dark"
                        style={styles.dialogBlur}
                    >
                        <View style={styles.dialogHeader}>
                            <MaterialCommunityIcons
                                name="github"
                                size={24}
                                color="#FFFFFF"
                                style={styles.dialogIcon}
                            />
                            <Text style={styles.dialogTitle}>
                                {repoName.split('/')[1]}
                            </Text>
                            <View style={styles.headerMetaContainer}>
                                <Text style={styles.dialogSubtitle}>
                                    {repoName.split('/')[0]}
                                </Text>
                                {repoInfo && (
                                    <View style={styles.statsContainer}>
                                        <View style={styles.statItem}>
                                            <MaterialCommunityIcons
                                                name="star"
                                                size={13}
                                                color="#FFD700"
                                            />
                                            <Text style={styles.statNumber}>
                                                {formatNumber(
                                                    repoInfo.stargazers_count,
                                                )}
                                            </Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <MaterialCommunityIcons
                                                name="source-fork"
                                                size={13}
                                                color="#0A84FF"
                                            />
                                            <Text style={styles.statNumber}>
                                                {formatNumber(
                                                    repoInfo.forks_count,
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>

                        <Dialog.Content style={styles.dialogContent}>
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator
                                        size="small"
                                        color="#0A84FF"
                                    />
                                    <Text style={styles.loadingText}>
                                        Loading repository info...
                                    </Text>
                                </View>
                            ) : error ? (
                                <View style={styles.errorContainer}>
                                    <MaterialCommunityIcons
                                        name="alert-circle"
                                        size={24}
                                        color="#FF453A"
                                        style={styles.errorIcon}
                                    />
                                    <Text style={styles.errorText}>
                                        {error}
                                    </Text>
                                </View>
                            ) : repoInfo ? (
                                <View style={styles.infoContainer}>
                                    {repoInfo.description && (
                                        <Text style={styles.description}>
                                            {repoInfo.description}
                                        </Text>
                                    )}
                                    {commits.length > 0 && (
                                        <View>
                                            <ScrollView
                                                style={styles.commitsScrollView}
                                                contentContainerStyle={
                                                    styles.commitsContainer
                                                }
                                                showsVerticalScrollIndicator={
                                                    Platform.OS === 'web'
                                                }
                                            >
                                                {commits.map(
                                                    (commit, index) => (
                                                        <Pressable
                                                            key={commit.sha}
                                                            onPress={() => {
                                                                const commitUrl = `https://github.com/${repoName}/commit/${commit.sha}`
                                                                if (
                                                                    Platform.OS !==
                                                                    'web'
                                                                ) {
                                                                    WebBrowser.openBrowserAsync(
                                                                        commitUrl,
                                                                    )
                                                                } else {
                                                                    window.open(
                                                                        commitUrl,
                                                                        '_blank',
                                                                    )
                                                                }
                                                            }}
                                                            style={({
                                                                pressed,
                                                            }) => [
                                                                styles.commitContainer,
                                                                index === 0 &&
                                                                    styles.latestCommitContainer,
                                                                pressed &&
                                                                    styles.commitContainerPressed,
                                                                index > 0 &&
                                                                    styles.subsequentCommit,
                                                            ]}
                                                        >
                                                            {index === 0 && (
                                                                <View
                                                                    style={
                                                                        styles.latestLabel
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.latestLabelText
                                                                        }
                                                                    >
                                                                        Latest
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            <View
                                                                style={
                                                                    styles.commitIcon
                                                                }
                                                            >
                                                                <MaterialCommunityIcons
                                                                    name="source-commit"
                                                                    size={16}
                                                                    color="#98989F"
                                                                />
                                                            </View>
                                                            <View
                                                                style={
                                                                    styles.commitContent
                                                                }
                                                            >
                                                                <Text
                                                                    style={
                                                                        styles.commitMessage
                                                                    }
                                                                    numberOfLines={
                                                                        1
                                                                    }
                                                                >
                                                                    {
                                                                        commit.message
                                                                    }
                                                                </Text>
                                                                <View
                                                                    style={
                                                                        styles.commitMeta
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.commitHash
                                                                        }
                                                                    >
                                                                        {
                                                                            commit.sha
                                                                        }
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.commitDate
                                                                        }
                                                                    >
                                                                        •{' '}
                                                                        {formatTimeAgo(
                                                                            commit.date,
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        </Pressable>
                                                    ),
                                                )}
                                                {hasMore && (
                                                    <Pressable
                                                        onPress={
                                                            fetchMoreCommits
                                                        }
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.loadMoreButton,
                                                            pressed &&
                                                                styles.loadMoreButtonPressed,
                                                        ]}
                                                        disabled={loadingMore}
                                                    >
                                                        {loadingMore ? (
                                                            <ActivityIndicator
                                                                size="small"
                                                                color="#98989F"
                                                            />
                                                        ) : (
                                                            <>
                                                                <MaterialCommunityIcons
                                                                    name="source-branch"
                                                                    size={12}
                                                                    color="#98989F"
                                                                    style={
                                                                        styles.loadMoreIcon
                                                                    }
                                                                />
                                                                <Text
                                                                    style={
                                                                        styles.loadMoreText
                                                                    }
                                                                >
                                                                    Load more
                                                                    commits
                                                                </Text>
                                                            </>
                                                        )}
                                                    </Pressable>
                                                )}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>
                            ) : null}
                        </Dialog.Content>

                        <Dialog.Actions style={styles.dialogActions}>
                            <Pressable
                                onPress={() => setVisible(false)}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && styles.closeButtonPressed,
                                ]}
                            >
                                <Text style={styles.closeButtonText}>Done</Text>
                            </Pressable>
                        </Dialog.Actions>
                    </BlurView>
                </Dialog>
            </Portal>
        </>
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
    dialog: {
        backgroundColor: 'transparent',
        borderRadius: 14,
        marginHorizontal: 8,
    },
    dialogBlur: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    dialogHeader: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
        gap: 6,
    },
    dialogIcon: {
        marginBottom: 2,
    },
    dialogTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
    },
    headerMetaContainer: {
        alignItems: 'center',
        gap: 4,
    },
    dialogSubtitle: {
        color: '#98989F',
        fontSize: 15,
        fontWeight: '400',
    },
    dialogContent: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 20,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    loadingText: {
        color: '#98989F',
        fontSize: 15,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    errorIcon: {
        marginRight: 4,
    },
    errorText: {
        color: '#FF453A',
        fontSize: 15,
        flex: 1,
    },
    infoContainer: {
        gap: 20,
    },
    description: {
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 20,
        textAlign: 'center',
    },
    commitsScrollView: {
        flexGrow: 0,
        margin: 0,
    },
    commitsContainer: {
        gap: 2,
        paddingVertical: 0,
        margin: 0,
        flexGrow: 1,
    },
    commitContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 8,
        borderRadius: 8,
        marginVertical: 0,
    },
    latestCommitContainer: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
    },
    latestLabel: {
        position: 'absolute',
        right: 8,
        top: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    latestLabelText: {
        color: '#98989F',
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 0,
    },
    commitContainerPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    commitIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    commitContent: {
        flex: 1,
        gap: 2,
    },
    commitMessage: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '500',
    },
    commitMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    commitHash: {
        color: '#98989F',
        fontSize: 13,
        fontFamily: Platform.select({
            ios: 'Menlo',
            android: 'monospace',
        }),
    },
    commitDate: {
        color: '#98989F',
        fontSize: 13,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    statDivider: {
        width: StyleSheet.hairlineWidth,
        height: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    statNumber: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
        opacity: 0.9,
    },
    dialogActions: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
        padding: 12,
        paddingBottom: Platform.OS === 'ios' ? 12 : 16,
        alignItems: 'center',
    },
    closeButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        minWidth: 140,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    closeButtonPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    closeButtonText: {
        color: '#0A84FF',
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.4,
    },
    subsequentCommit: {
        opacity: 0.8,
    },
    loadMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    loadMoreButtonPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    loadMoreIcon: {
        marginTop: 1,
    },
    loadMoreText: {
        color: '#98989F',
        fontSize: 13,
        fontWeight: '500',
    },
})
